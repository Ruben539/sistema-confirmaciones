import * as Baileys from "@whiskeysockets/baileys";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { makeInMemoryStore } = require("@whiskeysockets/baileys");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrcode = require("qrcode-terminal") as { generate: (qr: string, opts: object) => void };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrImage = require("qr-image") as { image: (text: string, opts: object) => NodeJS.ReadableStream };

import LeadExternal from "../../domain/lead-external.repository";
import fs from "fs";
import path from "path";

//Silent mode
import pino from "pino";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "chatbot");

export class BaileysTransporter implements LeadExternal {
  private sessionName: string = "tokens/default";
  public connection: Baileys.WASocket | null = null;
  public connectionState: Partial<Baileys.ConnectionState> | null = null;
  private isEnd: boolean = false;
  private closedMessage: string = "Connection closed";
  private onReady: Array<(connection: Baileys.WASocket) => void> = [];
  private onMessageCallback: ((phone: string, message: string, groupJid?: string, isMentioned?: boolean, mediaType?: string, mediaPath?: string, replyJid?: string) => void) | null = null;

  set onMessage(cb: (phone: string, message: string, groupJid?: string, isMentioned?: boolean, mediaType?: string, mediaPath?: string, replyJid?: string) => void) {
    this.onMessageCallback = cb;
  }

  private store: any = null;
  private lastMsgMap: Map<string, any> = new Map();

  constructor(sessionName: string = "default", private baileys: typeof Baileys = Baileys) {
    this.sessionName = `tokens/${sessionName}`;
    try {
      if (typeof makeInMemoryStore === "function") {
        this.store = makeInMemoryStore({ logger: pino({ level: "silent" }) as any });
      }
    } catch (e) {
      console.warn("[Baileys] No se pudo crear inMemoryStore:", (e as Error).message);
    }
    this.start();
  }

  private async getAuth(): Promise<any> {
    try {
      return await this.baileys.useMultiFileAuthState(this.sessionName);
    } catch (error) {
      console.log(error);
    }
  }

  set onready(cb: (conection: Baileys.WASocket) => void) {
    if (this.connectionState?.connection == "open") cb(this.connection!);
    this.onReady.push(cb);
  }

  async start(socketConfig: Baileys.UserFacingSocketConfig = {} as any) {
    try {
      const { saveCreds, state } = await this.getAuth();
      const { version } = await this.baileys.fetchLatestBaileysVersion();

      this.connection = this.baileys.makeWASocket({
        version,
        browser: this.baileys.Browsers.ubuntu("Chrome"),
        //@ts-ignore
        logger: pino({ level: "silent" }),
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 5,
        markOnlineOnConnect: true,
        syncFullHistory: false,
        getMessage: async (key) => {
          if (this.store && key.remoteJid && key.id) {
            try {
              const msg = await this.store.loadMessage(key.remoteJid, key.id);
              return msg?.message || undefined;
            } catch (e) {
              return undefined;
            }
          }
          return undefined;
        },
        ...socketConfig,
        auth: socketConfig.auth || state,
      });

      if (this.store) {
        this.store.bind(this.connection.ev);
      }
      this.connection.ev.on("creds.update", saveCreds);
      this.connection.ev.on("messages.upsert", async ({ messages, type }) => {
        // "append" = mensajes históricos al reconectar — ignorar para evitar doble procesamiento
        if (type === "append") {
          console.log(`[Baileys] Ignorando ${messages.length} mensaje(s) histórico(s) del downtime.`);
          return;
        }
        for (const msg of messages) {
          if (msg.key.fromMe) continue;

          const remoteJid = msg.key.remoteJid ?? "";
          // Ignorar mensajes de estados/broadcast de WhatsApp
          const isGroup = remoteJid.endsWith("@g.us");
          let senderJid = isGroup ? (msg.key.participant ?? "") : remoteJid;

          // Si el JID viene codificado como LID (@lid), extraer el número real (senderPn / participantPn)
          const keyAny = msg.key as any;
          const pnJid = keyAny.senderPn || keyAny.participantPn || keyAny.remoteJidAlt || keyAny.participantAlt || keyAny.remoteJidPhone;
          if (pnJid) {
            senderJid = pnJid;
          } else if (senderJid.endsWith("@lid") && remoteJid.endsWith("@s.whatsapp.net")) {
            senderJid = remoteJid;
          }

          // Limpiar cualquier sufijo @dominio para obtener solo el número
          const phone = senderJid.replace(/@[a-z.]+$/, "");
          const groupJid = isGroup ? remoteJid : undefined;

          if (phone) {
            this.lastMsgMap.set(phone, msg);
          }

          console.log(`[Baileys] Key:`, JSON.stringify({ remoteJid: msg.key.remoteJid, senderPn: keyAny.senderPn, participantPn: keyAny.participantPn, participant: msg.key.participant }), `-> phone: ${phone}`);

          // El caption de imagen/video también cuenta como texto
          const text =
            msg.message?.conversation ??
            msg.message?.extendedTextMessage?.text ??
            msg.message?.imageMessage?.caption ??
            msg.message?.videoMessage?.caption ??
            "";

          // Detectar tipo multimedia (independiente del texto/caption)
          const hasImage = !!msg.message?.imageMessage;
          const mediaType = hasImage                          ? "imagen"
            : msg.message?.audioMessage                      ? "audio"
            : msg.message?.videoMessage && !text             ? "video"
            : msg.message?.documentMessage                   ? "documento"
            : msg.message?.stickerMessage                    ? "sticker"
            : msg.message?.locationMessage                   ? "ubicacion"
            : msg.message?.contactMessage                    ? "contacto"
            : undefined;

          if (!phone || (!text && !mediaType)) continue;

          // Descargar imagen y guardar en disco para adjuntar al ticket
          let mediaPath: string | undefined;
          if (hasImage) {
            try {
              if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
              const buffer = await Baileys.downloadMediaMessage(msg, "buffer", {}) as Buffer;
              const filename = `${phone}_${Date.now()}.jpg`;
              mediaPath = path.join(UPLOADS_DIR, filename);
              fs.writeFileSync(mediaPath, buffer);
            } catch (e) {
              console.warn("[Baileys] No se pudo descargar la imagen:", (e as Error).message);
            }
          }

          // Detectar @mención al bot
          const contextInfo =
            msg.message?.extendedTextMessage?.contextInfo ??
            msg.message?.imageMessage?.contextInfo ??
            msg.message?.audioMessage?.contextInfo ??
            msg.message?.videoMessage?.contextInfo ??
            msg.message?.documentMessage?.contextInfo;

          const mentionedJids: string[] = contextInfo?.mentionedJid ?? [];
          const botPhone = this.connection?.user?.id?.split(":")[0].split("@")[0] ?? "";
          const isMentioned = mentionedJids.some(jid => jid.startsWith(botPhone));

          if (this.onMessageCallback) {
            console.log(`[Baileys] Mensaje de ${phone}${groupJid ? ` (grupo: ${groupJid})` : ""}${isMentioned ? " [@mencionado]" : ""}${mediaType ? ` [${mediaType}]` : ""}${mediaPath ? " [imagen guardada]" : ""}: "${text}"`);
            this.onMessageCallback(phone, text, groupJid, isMentioned, mediaType, mediaPath, senderJid);
          }
        }
      });
      this.connection.ev.on("connection.update", (state) => {
        this.connectionState = state;

        console.log("[Baileys] connection.update:", JSON.stringify({
          connection: state.connection,
          hasQR: !!state.qr,
          isNewLogin: state.isNewLogin,
          receivedPendingNotifications: state.receivedPendingNotifications,
          lastDisconnect: state.lastDisconnect
            ? { statusCode: (state.lastDisconnect.error as any)?.output?.statusCode, message: state.lastDisconnect.error?.message }
            : null,
        }));

        if (state.qr) {
          console.log("\n📱 Escanea este QR con WhatsApp (Dispositivos vinculados):\n");
          qrcode.generate(state.qr, { small: true });
          try {
            if (!fs.existsSync("tmp")) fs.mkdirSync("tmp", { recursive: true });
            qrImage.image(state.qr, { type: "png" }).pipe(fs.createWriteStream("tmp/whatsapp-qr.png"));
          } catch (e) {
            console.warn("[Baileys] No se pudo generar la imagen del QR:", (e as Error).message);
          }
        }

        if (state.connection === "open") {
          console.log("✅ WhatsApp conectado correctamente.");
          this.onReady.forEach((cb) => cb(this.connection!));
        }

        if (state.connection != "close") return;
        if (this.isEnd) {
          console.log(this.closedMessage);
          return;
        }

        // statusCode 401 = DisconnectReason.loggedOut: la sesión fue invalidada (desvinculada
        // desde el teléfono, o vencida) y no se puede recuperar reconectando con las mismas
        // credenciales — Baileys se queda reintentando para siempre sin ofrecer un QR nuevo
        // mientras exista un creds.json en la carpeta de sesión. Se respalda (nunca se borra)
        // y se arranca de nuevo para que pida un QR nuevo automáticamente.
        const statusCode = (state.lastDisconnect?.error as any)?.output?.statusCode;
        if (statusCode === this.baileys.DisconnectReason.loggedOut) {
          console.log("[Baileys] Sesión inválida (401 loggedOut). Se respalda y se pide un QR nuevo.");
          this.clearSession();
        }

        this.reconnect();
      });
    } catch (error) {
      console.error(error);
    }
  }

  end() {
    this.isEnd = true;
    this.connection?.end(undefined);
  }

  private reconnect(socketConfig: Baileys.UserFacingSocketConfig = {} as any) {
    this.start(socketConfig);
    console.log("Reconnecting...");
  }

  // Respalda la carpeta de sesión vencida renombrándola (nunca se borra), para que el próximo
  // useMultiFileAuthState() arranque sin credenciales y Baileys emita un QR nuevo.
  private clearSession(): void {
    try {
      if (fs.existsSync(this.sessionName)) {
        const backupPath = `${this.sessionName}_old_${Date.now()}`;
        fs.renameSync(this.sessionName, backupPath);
        console.log(`[Baileys] Sesión vieja respaldada en ${backupPath}`);
      }
    } catch (e) {
      console.warn("[Baileys] No se pudo respaldar la sesión vieja:", (e as Error).message);
    }
  }

  private sendQueue: Promise<any> = Promise.resolve();
  private lastSendTimestamp: number = 0;
  private MANDATORY_DELAY_MS: number = 15000;

  async sendMsg({ message, phone, groupJid, replyJid, mediaUrl }: { message: string; phone: string; groupJid?: string; replyJid?: string; mediaUrl?: string }): Promise<any> {
    this.sendQueue = this.sendQueue.then(() => this.executeSend({ message, phone, groupJid, replyJid, mediaUrl }));
    return this.sendQueue;
  }

  private async executeSend({ message, phone, groupJid, replyJid, mediaUrl }: { message: string; phone: string; groupJid?: string; replyJid?: string; mediaUrl?: string }): Promise<any> {
    const isConversationalReply = !!replyJid;
    const requiredDelay = isConversationalReply ? 1000 : this.MANDATORY_DELAY_MS;

    if (this.lastSendTimestamp > 0) {
      const elapsed = Date.now() - this.lastSendTimestamp;
      if (elapsed < requiredDelay) {
        const waitMs = requiredDelay - elapsed;
        if (!isConversationalReply) {
          console.log(`[Baileys Anti-Spam Queue] Esperando ${(waitMs / 1000).toFixed(1)}s para respetar el delay obligatorio de 15s entre envíos masivos...`);
        }
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }

    console.log(`[Baileys] >>> Enviando a phone=${phone}${groupJid ? ` groupJid=${groupJid}` : ""}${replyJid ? ` replyJid=${replyJid}` : ""}${mediaUrl ? ` [mediaUrl=${mediaUrl}]` : ""}`);

    try {
      if (!this.connection || this.connectionState?.connection !== "open") {
        throw new Error("No se puede enviar: la conexión con WhatsApp no está abierta.");
      }

      const cleanPhone = phone.replace(/[^\d]/g, "");
      const lastMsg = this.lastMsgMap.get(cleanPhone);

      let jid: string;
      const sendOptions: any = {};

      if (groupJid) {
        jid = groupJid;
      } else if (lastMsg && lastMsg.key && lastMsg.key.remoteJid) {
        // Para respuestas a mensajes del usuario, citar el mensaje original (quoted) y usar su remoteJid
        // para que libsignal utilice el trinquete (ratchet) y registrationId exacto del mensaje entrante.
        jid = lastMsg.key.remoteJid;
        sendOptions.quoted = lastMsg;
      } else if (replyJid && replyJid.endsWith("@s.whatsapp.net")) {
        jid = replyJid;
      } else if (cleanPhone) {
        jid = `${cleanPhone}@s.whatsapp.net`;
      } else {
        throw new Error(`No se pudo determinar un JID válido para el número "${phone}"`);
      }

      const messageContent = mediaUrl
        ? { image: { url: mediaUrl }, caption: message }
        : { text: message };

      console.log(`[Baileys] >>> Destino final resolved JID: ${jid}${sendOptions.quoted ? " (con cita / quoted)" : ""}${mediaUrl ? " (con imagen QR)" : ""}`);
      const response = await this.connection.sendMessage(jid, messageContent, sendOptions);
      this.lastSendTimestamp = Date.now();
      console.log(`[Baileys] <<< Enviado exitosamente a ${jid} -> id=${response?.key?.id ?? "sin id"}`);
      return response;
    } catch (error) {
      console.error(`[Baileys] <<< FALLÓ el envío a phone=${phone}:`, (error as Error).message);
      throw error;
    }
  }
}
