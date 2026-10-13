import { ContainerBuilder } from "node-dependency-injection";
import { LeadCreate } from "../application/lead.create";
import { ChatbotService } from "../application/chatbot.service";
import LeadCtrl from "./controller/lead.ctrl";
import MysqlRepository from "./repositories/mysql.repository";
import { ConversacionPostgresRepository } from "./repositories/conversacion.mysql.repository";
import { TicketPostgresRepository } from "./repositories/ticket.postgres.repository";
import { BaileysTransporter } from "./repositories/baileys.repository";

const container = new ContainerBuilder();

container.register("ws.transporter", BaileysTransporter);
const wsTransporter = container.get("ws.transporter") as BaileysTransporter;

container.register("db.repository", MysqlRepository);
const dbRepository = container.get("db.repository");

container.register("conversacion.repository", ConversacionPostgresRepository);
const conversacionRepository = container.get("conversacion.repository");

container.register("ticket.repository", TicketPostgresRepository);
const ticketRepository = container.get("ticket.repository");

container
  .register("lead.creator", LeadCreate)
  .addArgument([dbRepository, wsTransporter]);

const leadCreator = container.get("lead.creator");

container
  .register("chatbot.service", ChatbotService)
  .addArgument(conversacionRepository)
  .addArgument(wsTransporter)
  .addArgument(ticketRepository);

const chatbotService = container.get("chatbot.service") as ChatbotService;

import axios from "axios";

async function sendToLaravelRsvp(phone: string, message: string) {
  const candidateUrls: string[] = [];

  // 1. Dominio oficial del servidor en producción
  candidateUrls.push("https://confirmaciones.factosystem.com.py/api/rsvp/incoming-whatsapp");

  // 2. Variables de entorno si están definidas
  if (process.env.LARAVEL_API_URL) {
    candidateUrls.push(process.env.LARAVEL_API_URL);
  }
  if (process.env.LARAVEL_URL) {
    const base = process.env.LARAVEL_URL.replace(/\/$/, "");
    candidateUrls.push(`${base}/api/rsvp/incoming-whatsapp`);
  }

  // 3. Candidatos locales en el servidor (Nginx en puerto 80 / Artisan en puerto 8000)
  candidateUrls.push("http://127.0.0.1/api/rsvp/incoming-whatsapp");
  candidateUrls.push("http://127.0.0.1:8000/api/rsvp/incoming-whatsapp");
  candidateUrls.push("http://localhost/api/rsvp/incoming-whatsapp");

  // De-duplicate URLs
  const uniqueUrls = Array.from(new Set(candidateUrls));

  for (const url of uniqueUrls) {
    try {
      console.log(`[Baileys RSVP] Enviando webhook de ${phone} a Laravel (${url})...`);
      const res = await axios.post(url, { phone, message }, { timeout: 8000 });
      return res;
    } catch (err: any) {
      if (err.response) {
        console.warn(`[Baileys RSVP] Laravel respondió con estado HTTP ${err.response.status} en ${url}`);
        return err.response;
      }
      console.warn(`[Baileys RSVP] Falló conexión a ${url} (${err.code || err.message}). Probando alternativa...`);
    }
  }

  throw new Error("No se pudo conectar a ningún endpoint local ni remoto de Laravel");
}

// Integración con Laravel: Procesamiento de respuestas 1/2 de invitaciones de boda
wsTransporter.onMessage = async (phone: string, message: string, groupJid?: string, isMentioned?: boolean, mediaType?: string, mediaPath?: string, replyJid?: string) => {
  try {
    const res = await sendToLaravelRsvp(phone, message);

    if (res && res.data && res.data.reply) {
      console.log(`[Baileys RSVP] Respuesta enviada a ${phone}: ${res.data.reply.slice(0, 50)}...${res.data.media_url ? ' [QR adjunto]' : ''}`);
      await wsTransporter.sendMsg({
        phone,
        replyJid,
        groupJid,
        message: res.data.reply,
        mediaUrl: res.data.media_url
      });
    } else {
      console.log(`[Baileys RSVP] Laravel no generó respuesta para ${phone} (data: ${JSON.stringify(res?.data || {})})`);
    }
  } catch (error: any) {
    console.error(`[Baileys RSVP Error] No se pudo procesar respuesta para ${phone}:`, error?.message || error);
  }
};

container.register("lead.ctrl", LeadCtrl).addArgument(leadCreator);

export default container;
