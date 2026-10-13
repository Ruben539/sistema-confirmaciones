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
        const storeDir = path.join(process.cwd(), "tokens");
        if (!fs.existsSync(storeDir)) {
          fs.mkdirSync(storeDir, { recursive: true });
        }
        const storeFile = path.join(storeDir, `${sessionName}_store.json`);
        if (fs.existsSync(storeFile)) {
          try {
            this.store.readFromFile(storeFile);
          } catch (_) {}
        }
        // Guardar store periódicamente para responder a reintentos de cifrado (Signal Protocol)
        setInterval(() => {
          try {
            if (this.store) this.store.writeToFile(storeFile);
          } catch (_) {}
        }, 15000);
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

  private retryMap = new Map<string, number>();
  private msgRetryCounterCache = {
    get: (key: string) => this.retryMap.get(key),
    set: (key: string, value: any) => this.retryMap.set(key, value),
    del: (key: string) => this.retryMap.delete(key),
    flushAll: () => this.retryMap.clear(),
  };

  async start(socketConfig: Baileys.UserFacingSocketConfig = {} as any) {
    try {
      // Limpiar completamente el socket anterior para evitar múltiples instancias concurrentes que causan Bad MAC
      if (this.connection) {
        try {
          this.connection.ev.removeAllListeners("messages.upsert");
          this.connection.ev.removeAllListeners("connection.update");
          this.connection.ev.removeAllListeners("creds.update");
          this.connection.end(undefined);
        } catch (_) {}
        this.connection = null;
      }

      const { saveCreds, state } = await this.getAuth();
      const { version } = await this.baileys.fetchLatestBaileysVersion();

      this.connection = this.baileys.makeWASocket({
        version,
        browser: this.baileys.Browsers.ubuntu("Chrome"),
        //@ts-ignore
        logger: pino({ level: "silent" }),
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 5,
        msgRetryCounterCache: this.msgRetryCounterCache as any,
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
        // Caché en memoria de las claves Signal: evita lecturas/escrituras concurrentes al disco que corrompen sesiones (Bad MAC)
        auth: socketConfig.auth || {
          creds: state.creds,
          keys: this.baileys.makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }) as any),
        },
      });

      if (this.store) {
        this.store.bind(this.connection.ev);
      }
      this.connection.ev.on("creds.update", saveCreds);
      this.connection.ev.on("messages.upsert", async ({ messages, type }) => {
        const nowSeconds = Math.floor(Date.now() / 1000);

        for (const msg of messages) {
          if (msg.key.fromMe) continue;

          // Ignorar chats históricos. Los "notify" pueden llegar tarde (bot reconectando o reintento de cifrado
          // que conserva la hora original), así que se aceptan hasta 12 h; el resto (append/historial) hasta 10 min.
          const rawTimestamp = msg.messageTimestamp;
          const msgTimestamp = typeof rawTimestamp === "number"
            ? rawTimestamp
            : Number((rawTimestamp as any)?.low || (rawTimestamp as any) || 0);
          const maxAgeSeconds = type === "notify" ? 12 * 60 * 60 : 600;

          if (msgTimestamp > 0 && (nowSeconds - msgTimestamp) > maxAgeSeconds) {
            console.log(`[Baileys] Ignorando mensaje antiguo (${nowSeconds - msgTimestamp}s de antigüedad) de ${msg.key.remoteJid}`);
            continue;
          }

          const remoteJid = msg.key.remoteJid ?? "";
          // Ignorar mensajes de estados/broadcast de WhatsApp
          if (remoteJid === "status@broadcast" || remoteJid.includes("@broadcast")) continue;

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
          const cleanPhone = phone.replace(/[^\d]/g, "");
          const groupJid = isGroup ? remoteJid : undefined;

          if (cleanPhone) {
            this.lastMsgMap.set(cleanPhone, msg);
          }
          if (phone && phone !== cleanPhone) {
            this.lastMsgMap.set(phone, msg);
          }

          console.log(`[Baileys] Recibido [${type}]:`, JSON.stringify({ remoteJid: msg.key.remoteJid, senderPn: keyAny.senderPn, participantPn: keyAny.participantPn, participant: msg.key.participant }), `-> phone: ${phone}`);

          // Mensaje que no se pudo descifrar (Bad MAC / "messages into the future"): llega sin contenido.
          // Baileys pide reenvío al remitente; si llega descifrado vuelve a entrar por este mismo evento.
          if (msg.messageStubType === this.baileys.WAMessageStubType.CIPHERTEXT) {
            console.warn(`[Baileys] ⚠️ No se pudo descifrar el mensaje de ${phone} (id=${msg.key.id}): ${JSON.stringify(msg.messageStubParameters ?? [])}. Se espera reenvío; si no llega, la sesión de cifrado está dañada.`);
            continue;
          }

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

  private reconnectTimer: NodeJS.Timeout | null = null;

  private reconnect(socketConfig: Baileys.UserFacingSocketConfig = {} as any) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    console.log("[Baileys] Reconectando en 2.5 segundos...");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.start(socketConfig);
    }, 2500);
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

      let messageContent: any;
      if (mediaUrl && typeof mediaUrl === 'string' && mediaUrl.trim().length > 0) {
        if (fs.existsSync(mediaUrl)) {
          messageContent = { image: fs.readFileSync(mediaUrl), caption: message };
        } else {
          messageContent = { image: { url: mediaUrl }, caption: message };
        }
      } else {
        messageContent = { text: message };
      }

      console.log(`[Baileys] >>> Destino final resolved JID: ${jid}${sendOptions.quoted ? " (con cita / quoted)" : ""}${mediaUrl ? " (con imagen QR)" : ""}`);
      let response: any;
      try {
        response = await this.connection.sendMessage(jid, messageContent, sendOptions);
      } catch (mediaError) {
        if (!messageContent.image) throw mediaError;
        // Si falla la descarga/envío de la imagen del QR, enviar igual el texto con el link al QR
        console.warn(`[Baileys] No se pudo enviar la imagen a ${jid} (${(mediaError as Error).message}). Se envía solo el texto con el link.`);
        const qrLink = /^https?:\/\//.test(mediaUrl!) ? `\n\n🎟️ Tu código QR: ${mediaUrl}` : "";
        response = await this.connection.sendMessage(jid, { text: `${message}${qrLink}` }, sendOptions);
      }
      this.lastSendTimestamp = Date.now();
      console.log(`[Baileys] <<< Enviado exitosamente a ${jid} -> id=${response?.key?.id ?? "sin id"}`);
      return response;
    } catch (error) {
      console.error(`[Baileys] <<< FALLÓ el envío a phone=${phone}:`, (error as Error).message);
      throw error;
    }
  }
}
