import { CategoriaConversacion, Conversacion, DireccionMensaje, EstatusConversacion, EtapaConversacion, TipoEmisor } from './conversacion';

export default interface ConversacionRepository {
    findActiveByPhone(phone: string, groupJid?: string): Promise<Conversacion | null>;
    create(phone: string, groupJid?: string, merchandiserId?: number, corporacionId?: number): Promise<Conversacion>;
    ultimoMensaje(conversacion_id: number): Promise<Date | null>;
    guardarMensaje(
        conversacion_id: number,
        direccion: DireccionMensaje,
        tipo_emisor: TipoEmisor,
        mensaje: string,
        seg_desde_anterior?: number
    ): Promise<void>;
    actualizarEstatus(id: number, estatus: EstatusConversacion): Promise<void>;
    actualizarCategoria(id: number, categoria: CategoriaConversacion): Promise<void>;
    guardarSatisfaccion(id: number, satisfaccion: number): Promise<void>;
    guardarTiempoRespuesta(id: number, segundos: number): Promise<void>;
    actualizarEtapa(id: number, etapa: EtapaConversacion): Promise<void>;
    vincularTicket(id: number, tarea_desarrollador_id: number): Promise<void>;
    cerrar(id: number, segundos_resolucion: number): Promise<void>;
}
