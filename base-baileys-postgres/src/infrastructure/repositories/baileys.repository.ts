import * as Baileys from "@whiskeysockets/baileys";
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

  private lastMsgMap: Map<string, any> = new Map();

  // Recent messages (incoming and sent), so Baileys can re-send one when the other side asks for a
  // retry because it couldn't decrypt it. Bounded: the old in-memory store kept every chat forever
  // and rewrote it to disk every 15 s, which slowed the bot down over time.
  private messageCache: Map<string, any> = new Map();
  private static readonly MESSAGE_CACHE_SIZE = 2000;

  private rememberMessage(msg: any) {
    const id = msg?.key?.id;
    if (!id || !msg.message) return;
    this.messageCache.delete(id);
    this.messageCache.set(id, msg);
    if (this.messageCache.size > BaileysTransporter.MESSAGE_CACHE_SIZE) {
      const oldest = this.messageCache.keys().next().value;
      if (oldest) this.messageCache.delete(oldest);
    }
  }

  // Connection health (see startWatchdog)
  private reconnectAttempts = 0;
  private lastOpenAt = Date.now();
  private waVersion: [number, number, number] | undefined;

  constructor(sessionName: string = "default", private baileys: typeof Baileys = Baileys) {
    this.sessionName = `tokens/${sessionName}`;
    this.startWatchdog();
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

      // Asked to GitHub on every (re)connection: if it fails (network blip) use the last known one,
      // or Baileys' built-in version, instead of aborting the reconnection
      try {
        const { version } = await this.baileys.fetchLatestBaileysVersion();
        if (version) this.waVersion = version as [number, number, number];
      } catch (e) {
        console.warn("[Baileys] No se pudo consultar la versión de WhatsApp Web, se usa la conocida:", (e as Error).message);
      }

      this.connection = this.baileys.makeWASocket({
        ...(this.waVersion ? { version: this.waVersion } : {}),
        browser: this.baileys.Browsers.ubuntu("Chrome"),
        //@ts-ignore
        logger: pino({ level: "silent" }),
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 5,
        msgRetryCounterCache: this.msgRetryCounterCache as any,
        // A person isn't "online" 24 h a day: WhatsApp watches it
        markOnlineOnConnect: false,
        syncFullHistory: false,
        getMessage: async (key) => (key.id ? this.messageCache.get(key.id)?.message : undefined),
        ...socketConfig,
        // Caché en memoria de las claves Signal: evita lecturas/escrituras concurrentes al disco que corrompen sesiones (Bad MAC)
        auth: socketConfig.auth || {
          creds: state.creds,
          keys: this.baileys.makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }) as any),
        },
      });

      this.connection.ev.on("creds.update", saveCreds);
      this.connection.ev.on("messages.upsert", async ({ messages, type }) => {
        const nowSeconds = Math.floor(Date.now() / 1000);

        for (const msg of messages) {
          this.rememberMessage(msg);
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
            this.lastMsgMap.delete(cleanPhone);
            this.lastMsgMap.set(cleanPhone, msg);
            if (this.lastMsgMap.size > 5000) {
              const oldest = this.lastMsgMap.keys().next().value;
              if (oldest) this.lastMsgMap.delete(oldest);
            }
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

          // Read it like a person: blue ticks 2-4 s after it arrives, not in the same millisecond
          // Blue ticks: right away only if BOT_AUTO_READ=true (automatic chatbot). Otherwise they appear when a
          // person opens the chat in the panel (see markChatRead), as in real WhatsApp
          if (!isGroup) {
            if (process.env.BOT_AUTO_READ === "true") this.markReadLater(msg);
            else this.rememberUnread(cleanPhone, msg);
          }

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
          this.reconnectAttempts = 0;
          this.lastOpenAt = Date.now();
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

        // 440 = connectionReplaced: another process/device opened this same session. Reconnecting fast
        // makes both fight and corrupts the encryption sessions (Bad MAC): wait and warn instead.
        if (statusCode === this.baileys.DisconnectReason.connectionReplaced) {
          console.error("[Baileys] ⚠️ Otra instancia está usando esta misma sesión de WhatsApp (440). Revisá que el bot corra una sola vez (pm2 ls / ps aux | grep node).");
          this.reconnect(60000);
          return;
        }

        this.reconnect();
      });
    } catch (error) {
      // Any failure while (re)connecting (auth files, network...) used to leave the bot dead until a manual restart
      console.error("[Baileys] Error al conectar, se reintenta:", (error as Error)?.message || error);
      this.reconnect();
    }
  }

  end() {
    this.isEnd = true;
    this.connection?.end(undefined);
  }

  private reconnectTimer: NodeJS.Timeout | null = null;

  // Exponential backoff: 2.5 s, 5 s, 10 s... up to 1 min, so a session that keeps failing doesn't
  // hammer WhatsApp (which can get the number blocked). Reset when the connection opens.
  private reconnect(forcedDelayMs?: number) {
    if (this.isEnd) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = forcedDelayMs ?? Math.min(60000, 2500 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts++;
    console.log(`[Baileys] Reconectando en ${Math.round(delay / 1000)} s (intento ${this.reconnectAttempts})...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.start();
    }, delay);
  }

  // If WhatsApp stays disconnected for 5 minutes (and isn't just waiting for a QR scan), exit so PM2
  // restarts the process: the same thing that was being done by hand with "pm2 restart".
  private startWatchdog() {
    const MAX_DOWN_MS = 5 * 60 * 1000;
    setInterval(() => {
      if (this.isEnd) return;
      if (this.connectionState?.connection === "open") {
        this.lastOpenAt = Date.now();
        return;
      }
      if (this.connectionState?.qr) return; // waiting for someone to scan the QR
      const downFor = Date.now() - this.lastOpenAt;
      if (downFor > MAX_DOWN_MS) {
        console.error(`[Baileys] ⚠️ WhatsApp lleva ${Math.round(downFor / 60000)} min sin conexión. Se reinicia el proceso (PM2 lo vuelve a levantar).`);
        process.exit(1);
      }
    }, 60000);
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

  private lastSendByJid = new Map<string, number>();

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min));
  }

  // Received messages not marked as read yet, per phone (digits), until a person opens the chat
  private unreadByPhone = new Map<string, any[]>();

  private rememberUnread(phone: string, msg: any): void {
    if (!phone || !msg?.key) return;
    const list = this.unreadByPhone.get(phone) || [];
    list.push(msg.key);
    this.unreadByPhone.set(phone, list.slice(-50));
    if (this.unreadByPhone.size > 5000) {
      const oldest = this.unreadByPhone.keys().next().value;
      if (oldest) this.unreadByPhone.delete(oldest);
    }
  }

  /**
   * A person opened the chat in the panel: the guest's messages get their blue ticks now (after a short,
   * human-like pause). Phones are matched by their last 9 digits (with or without 595, LID, other numbers).
   */
  async markChatRead(phones: string[]): Promise<number> {
    const wanted = phones.map((p) => String(p || "").replace(/[^\d]/g, "")).filter(Boolean).map((p) => p.slice(-9));
    const keys: any[] = [];
    for (const [phone, list] of this.unreadByPhone.entries()) {
      if (wanted.includes(phone.slice(-9))) {
        keys.push(...list);
        this.unreadByPhone.delete(phone);
      }
    }
    if (!keys.length || !this.connection) return 0;
    await this.sleep(this.randomBetween(800, 2000));
    await this.connection.readMessages(keys).catch((e: any) => console.warn("[Baileys] No se pudo marcar como leído:", e?.message));
    return keys.length;
  }

  private markReadLater(msg: any): void {
    setTimeout(() => {
      this.connection?.readMessages([msg.key]).catch((e: any) => console.warn("[Baileys] No se pudo marcar como leído:", e?.message));
    }, this.randomBetween(2000, 4000));
  }

  /**
   * Before writing to a person: a pause if we just wrote to that same chat (1.5-3 s between consecutive
   * messages) and "escribiendo..." for as long as a person would take to type it (50-80 ms per
   * character, between 2 and 12 s).
   */
  private async simulateTyping(jid: string, text: string): Promise<void> {
    const last = this.lastSendByJid.get(jid);
    if (last) {
      const gap = this.randomBetween(1500, 3000) - (Date.now() - last);
      if (gap > 0) await this.sleep(gap);
    }
    try {
      await this.connection?.presenceSubscribe(jid);
      await this.connection?.sendPresenceUpdate("composing", jid);
      const typingMs = Math.min(12000, Math.max(2000, (text?.length || 0) * this.randomBetween(50, 80)));
      await this.sleep(typingMs);
      await this.connection?.sendPresenceUpdate("paused", jid);
    } catch (e) {
      // Presence is cosmetic: never block the message for it
    }
  }

  private sendQueue: Promise<any> = Promise.resolve();
  private lastSendTimestamp: number = 0;
  // Gaps between two messages of the bot, to anyone (seconds, from the .env; random inside each range):
  //  - first messages (invitations, reminders, notices): never closer than this
  //  - answers to a guest who wrote: text / with an image (the QR pass after confirming)
  private MANDATORY_DELAY_MS: number = Number(process.env.BOT_SEND_DELAY_SECONDS || 15) * 1000;
  private REPLY_DELAY_MS: [number, number] = [
    Number(process.env.BOT_REPLY_MIN_SECONDS || 4) * 1000,
    Number(process.env.BOT_REPLY_MAX_SECONDS || 10) * 1000,
  ];
  private MEDIA_REPLY_DELAY_MS: [number, number] = [
    Number(process.env.BOT_MEDIA_MIN_SECONDS || 15) * 1000,
    Number(process.env.BOT_MEDIA_MAX_SECONDS || 30) * 1000,
  ];

  /**
   * Edits a text message we sent (WhatsApp allows it for 15 minutes). Goes through the same queue as the
   * rest so it never fires at the same time as another message.
   */
  async editMsg({ jid, id, message }: { jid: string; id: string; message: string }): Promise<any> {
    this.sendQueue = this.sendQueue.then(async () => {
      if (!this.connection || this.connectionState?.connection !== "open") {
        throw new Error("No se puede editar: la conexión con WhatsApp no está abierta.");
      }
      const key = { remoteJid: jid, fromMe: true, id };
      const response = await this.connection.sendMessage(jid, { text: message, edit: key } as any);
      this.lastSendTimestamp = Date.now();
      console.log(`[Baileys] <<< Mensaje ${id} editado en ${jid}`);
      return response;
    });
    return this.sendQueue;
  }

  async sendMsg({ message, phone, groupJid, replyJid, mediaUrl }: { message: string; phone: string; groupJid?: string; replyJid?: string; mediaUrl?: string }): Promise<any> {
    this.sendQueue = this.sendQueue.then(() => this.executeSend({ message, phone, groupJid, replyJid, mediaUrl }));
    return this.sendQueue;
  }

  private async executeSend({ message, phone, groupJid, replyJid, mediaUrl }: { message: string; phone: string; groupJid?: string; replyJid?: string; mediaUrl?: string }): Promise<any> {
    const isConversationalReply = !!replyJid;
    const hasMedia = !!(mediaUrl && mediaUrl.trim());
    // Several guests confirming at once don't get their QR one right after the other
    const requiredDelay = !isConversationalReply
      ? Math.max(this.MANDATORY_DELAY_MS, hasMedia ? this.MEDIA_REPLY_DELAY_MS[0] : 0)
      : hasMedia
        ? this.randomBetween(this.MEDIA_REPLY_DELAY_MS[0], this.MEDIA_REPLY_DELAY_MS[1])
        : this.randomBetween(this.REPLY_DELAY_MS[0], this.REPLY_DELAY_MS[1]);

    if (this.lastSendTimestamp > 0) {
      const elapsed = Date.now() - this.lastSendTimestamp;
      if (elapsed < requiredDelay) {
        const waitMs = requiredDelay - elapsed;
        console.log(`[Baileys Anti-Spam Queue] Esperando ${(waitMs / 1000).toFixed(1)}s antes del próximo mensaje${hasMedia ? " (con imagen)" : ""}...`);
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
        // Usar el remoteJid del mensaje entrante para que libsignal utilice el trinquete (ratchet) y
        // registrationId exacto del chat (incluye contactos @lid).
        jid = lastMsg.key.remoteJid;
        // Only the automatic answers quote the guest's message; one written by a person goes as a normal message
        if (isConversationalReply) sendOptions.quoted = lastMsg;
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
      if (!groupJid) await this.simulateTyping(jid, message);
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
      this.lastSendByJid.set(jid, Date.now());
      if (this.lastSendByJid.size > 5000) {
        const oldest = this.lastSendByJid.keys().next().value;
        if (oldest) this.lastSendByJid.delete(oldest);
      }
      this.rememberMessage(response);
      console.log(`[Baileys] <<< Enviado exitosamente a ${jid} -> id=${response?.key?.id ?? "sin id"}`);
      return response;
    } catch (error) {
      console.error(`[Baileys] <<< FALLÓ el envío a phone=${phone}:`, (error as Error).message);
      throw error;
    }
  }
}
