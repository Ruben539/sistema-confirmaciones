import { Router, Request, Response } from "express";
import container from "../ioc";
const router: Router = Router();

/**
 * http://localhost/read POST { phones: [...] }: a person opened the chat in the panel, mark the guest's
 * messages as read (blue ticks) in WhatsApp.
 */
router.post("/", async ({ body }: Request, res: Response) => {
  try {
    const phones: string[] = Array.isArray(body?.phones) ? body.phones : [];
    const transporter: any = container.get("ws.transporter");
    const count = await transporter.markChatRead(phones);
    res.send({ ok: true, read: count });
  } catch (error) {
    console.error("[ReadCtrl] Error al marcar como leído:", error);
    res.status(500).send({ error: "No se pudo marcar como leído" });
  }
});

export { router };
