import { Request, Response } from "express";
import { LeadCreate } from "../../application/lead.create";

class LeadCtrl {
  constructor(private readonly leadCreator: LeadCreate) {}

  public sendCtrl = async ({ body }: Request, res: Response) => {
    try {
      const { message, phone, groupJid, mediaUrl } = body;
      const response = await this.leadCreator.sendMessageAndSave({ message, phone, groupJid, mediaUrl });
      res.send(response);
    } catch (error) {
      console.error("[LeadCtrl] Error al enviar mensaje:", error);
      res.status(500).send({ error: "No se pudo enviar el mensaje" });
    }
  };
}

export default LeadCtrl;
