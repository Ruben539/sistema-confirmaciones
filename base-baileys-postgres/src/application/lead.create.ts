import LeadExternal from "../domain/lead-external.repository";
import LeadRepository from "../domain/lead.repository";

export class LeadCreate {
  private leadRepository: LeadRepository;
  private leadExternal: LeadExternal;
  constructor(respositories: [LeadRepository, LeadExternal]) {
    const [leadRepository, leadExternal] = respositories;
    this.leadRepository = leadRepository;
    this.leadExternal = leadExternal;
  }

  public async sendMessageAndSave({
    message,
    phone,
    groupJid,
    mediaUrl,
  }: {
    message: string;
    phone: string;
    groupJid?: string;
    mediaUrl?: string;
  }) {
    let responseDbSave = null;
    try {
      responseDbSave = await this.leadRepository.save({ message, phone });
    } catch (dbErr: any) {
      console.warn("[Baileys DB Notice] Error al guardar en base local (se continúa el envío):", dbErr?.message || dbErr);
    }

    const responseExSave = await this.leadExternal.sendMsg({ message, phone, groupJid, mediaUrl });
    return { responseDbSave, responseExSave };
  }
}
