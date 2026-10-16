import { Router, Request, Response } from "express";
import container from "../ioc";
const router: Router = Router();

/**
 * http://localhost/edit POST { jid, id, message }: edits a text message sent by the bot's number
 * (WhatsApp allows it during the 15 minutes after sending).
 */
router.post("/", async ({ body }: Request, res: Response) => {
  try {
    const { jid, id, message } = body || {};
    if (!jid || !id || !message) {
      res.status(422).send({ error: "Faltan jid, id o message" });
      return;
    }
    const transporter: any = container.get("ws.transporter");
    const response = await transporter.editMsg({ jid, id, message });
    res.send({ ok: true, response });
  } catch (error) {
    console.error("[EditCtrl] Error al editar mensaje:", error);
    res.status(500).send({ error: "No se pudo editar el mensaje" });
  }
});

export { router };
