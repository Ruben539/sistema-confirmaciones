import { Pool } from 'pg';
import { CategoriaConversacion, Conversacion, DireccionMensaje, EstatusConversacion, EtapaConversacion, TipoEmisor } from '../../domain/conversacion';
import ConversacionRepository from '../../domain/conversacion.repository';

export class ConversacionPostgresRepository implements ConversacionRepository {
    private pool: Pool;

    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST ?? '127.0.0.1',
            port: parseInt(process.env.DB_PORT ?? '5432'),
            database: process.env.DB_DATABASE ?? 'eventos',
            user: process.env.DB_USERNAME ?? 'postgres',
            password: String(process.env.DB_PASSWORD ?? ''),
        });
    }

    async findActiveByPhone(phone: string, groupJid?: string): Promise<Conversacion | null> {
        // Si viene de un grupo, la conversación activa es específica de ese teléfono + grupo
        // Si es mensaje directo, busca solo por teléfono
        const result = groupJid
            ? await this.pool.query(
                `SELECT * FROM conversaciones WHERE phone = $1 AND grupo_jid = $2 AND estatus = 'activo' ORDER BY id DESC LIMIT 1`,
                [phone, groupJid]
              )
            : await this.pool.query(
                `SELECT * FROM conversaciones WHERE phone = $1 AND grupo_jid IS NULL AND estatus = 'activo' ORDER BY id DESC LIMIT 1`,
                [phone]
              );
        if (!result.rows.length) return null;
        return result.rows[0] as Conversacion;
    }

    async create(phone: string, groupJid?: string, merchandiserId?: number, corporacionId?: number): Promise<Conversacion> {
        const result = await this.pool.query(
            `INSERT INTO conversaciones (phone, grupo_jid, merchandiser_id, corporacion_id, estatus, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'activo', NOW(), NOW()) RETURNING *`,
            [phone, groupJid ?? null, merchandiserId ?? null, corporacionId ?? null]
        );
        return result.rows[0] as Conversacion;
    }

    async ultimoMensaje(conversacion_id: number): Promise<Date | null> {
        const result = await this.pool.query(
            `SELECT created_at FROM mensajes_conversacion WHERE conversacion_id = $1 ORDER BY id DESC LIMIT 1`,
            [conversacion_id]
        );
        if (!result.rows.length) return null;
        return new Date(result.rows[0].created_at);
    }

    async guardarMensaje(
        conversacion_id: number,
        direccion: DireccionMensaje,
        tipo_emisor: TipoEmisor,
        mensaje: string,
        seg_desde_anterior?: number
    ): Promise<void> {
        await this.pool.query(
            `INSERT INTO mensajes_conversacion (conversacion_id, direccion, tipo_emisor, mensaje, seg_desde_anterior, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [conversacion_id, direccion, tipo_emisor, mensaje, seg_desde_anterior ?? null]
        );
    }

    async actualizarEstatus(id: number, estatus: EstatusConversacion): Promise<void> {
        await this.pool.query(
            `UPDATE conversaciones SET estatus = $1, updated_at = NOW() WHERE id = $2`,
            [estatus, id]
        );
    }

    async actualizarCategoria(id: number, categoria: CategoriaConversacion): Promise<void> {
        await this.pool.query(
            `UPDATE conversaciones SET categoria = $1, updated_at = NOW() WHERE id = $2`,
            [categoria, id]
        );
    }

    async guardarSatisfaccion(id: number, satisfaccion: number): Promise<void> {
        await this.pool.query(
            `UPDATE conversaciones SET satisfaccion = $1, updated_at = NOW() WHERE id = $2`,
            [satisfaccion, id]
        );
    }

    async guardarTiempoRespuesta(id: number, segundos: number): Promise<void> {
        await this.pool.query(
            `UPDATE conversaciones SET tiempo_primera_respuesta_seg = $1, updated_at = NOW() WHERE id = $2`,
            [segundos, id]
        );
    }

    async actualizarEtapa(id: number, etapa: EtapaConversacion): Promise<void> {
        await this.pool.query(
            `UPDATE conversaciones SET etapa = $1, updated_at = NOW() WHERE id = $2`,
            [etapa, id]
        );
    }

    async vincularTicket(id: number, tarea_desarrollador_id: number): Promise<void> {
        await this.pool.query(
            `UPDATE conversaciones SET tarea_desarrollador_id = $1, updated_at = NOW() WHERE id = $2`,
            [tarea_desarrollador_id, id]
        );
    }

    async cerrar(id: number, segundos_resolucion: number): Promise<void> {
        await this.pool.query(
            `UPDATE conversaciones SET estatus = 'resuelto', tiempo_resolucion_seg = $1, cerrado_at = NOW(), updated_at = NOW() WHERE id = $2`,
            [segundos_resolucion, id]
        );
    }
}
