export type EstatusConversacion = 'activo' | 'cerrado' | 'derivado' | 'resuelto';
export type EtapaConversacion = 'esperando_descripcion' | 'ticket_creado' | 'esperando_calificacion';
export type CategoriaConversacion = 'soporte_tecnico' | 'consulta_estado' | 'derivado_agente' | 'otro';
export type DireccionMensaje = 'entrante' | 'saliente';
export type TipoEmisor = 'cliente' | 'bot' | 'agente';

export interface Conversacion {
    id: number;
    phone: string;
    grupo_jid?: string;
    merchandiser_id?: number;
    corporacion_id?: number;
    nombre?: string;
    estatus: EstatusConversacion;
    categoria?: CategoriaConversacion;
    satisfaccion?: number;
    tiempo_primera_respuesta_seg?: number;
    tiempo_resolucion_seg?: number;
    cerrado_at?: Date;
    etapa?: EtapaConversacion;
    tarea_desarrollador_id?: number;
    created_at?: Date;
}

export interface MensajeConversacion {
    id?: number;
    conversacion_id: number;
    direccion: DireccionMensaje;
    tipo_emisor: TipoEmisor;
    mensaje: string;
    seg_desde_anterior?: number;
    created_at?: Date;
}
