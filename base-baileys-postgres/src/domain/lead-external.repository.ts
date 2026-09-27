export default interface LeadExternal {
    sendMsg(params: { message: string; phone: string; groupJid?: string; replyJid?: string; mediaUrl?: string }): Promise<any>
}
