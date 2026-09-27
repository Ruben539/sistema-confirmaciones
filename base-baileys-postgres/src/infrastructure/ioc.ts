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

// Integración con Laravel: Procesamiento de respuestas 1/2 de invitaciones de boda
wsTransporter.onMessage = async (phone: string, message: string, groupJid?: string, isMentioned?: boolean, mediaType?: string, mediaPath?: string, replyJid?: string) => {
  try {
    const targetUrl = process.env.LARAVEL_API_URL || "http://192.168.100.20:8000/api/rsvp/incoming-whatsapp";
    const res = await axios.post(targetUrl, { phone, message }, { timeout: 5000 });

    if (res && res.data && res.data.reply) {
      console.log(`[Baileys RSVP] Respuesta enviada a ${phone}: ${res.data.reply.slice(0, 50)}...${res.data.media_url ? ' [QR adjunto]' : ''}`);
      await wsTransporter.sendMsg({
        phone,
        replyJid,
        groupJid,
        message: res.data.reply,
        mediaUrl: res.data.media_url
      });
    }
  } catch (error: any) {
    console.error(`[Baileys RSVP Error] No se pudo conectar con Laravel (http://192.168.100.20:8000):`, error?.message || error);
  }
};

container.register("lead.ctrl", LeadCtrl).addArgument(leadCreator);

export default container;
