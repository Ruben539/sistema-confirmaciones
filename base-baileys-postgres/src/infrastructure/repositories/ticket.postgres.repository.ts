import { Pool } from 'pg';
import https from 'https';
import http from 'http';

export interface TicketCreado {
    id: number;
    name: string;
    estado_actual: string;
}

export class TicketPostgresRepository {
    private pool: Pool;
    private userId: number;
    private desarrolladorId: number;

    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST ?? '127.0.0.1',
            port: parseInt(process.env.DB_PORT ?? '5432'),
            database: process.env.DB_DATABASE ?? 'eventos',
            user: process.env.DB_USERNAME ?? 'postgres',
            password: String(process.env.DB_PASSWORD ?? ''),
        });
        this.userId = parseInt(process.env.SUPPORT_USER_ID ?? '1');
        this.desarrolladorId = parseInt(process.env.SUPPORT_DESARROLLADOR_ID ?? '1');
    }

    // desarrolladorId opcional: si se pasa, sobreescribe el default del .env
    // Permite que cada corporación tenga su propio desarrollador asignado
    async crear(phone: string, descripcion: string, prioridad: string = 'media', desarrolladorId?: number, archivoPath?: string): Promise<TicketCreado> {
        const asignadoA = desarrolladorId ?? this.desarrolladorId;
        const name = `WhatsApp soporte - ${phone}`;
        const result = await this.pool.query<TicketCreado>(
            `INSERT INTO tarea_desarrolladores
                (user_id, desarrollador_id, name, description, archivo, prioridad, estado_actual, estatus, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'pendiente', 0, NOW(), NOW())
             RETURNING id, name, estado_actual`,
            [this.userId, asignadoA, name, descripcion, archivoPath ?? null, prioridad]
        );
        const ticket = result.rows[0];

        // Notificar a Laravel para que envíe el email al desarrollador
        this.notificarLaravel(ticket.id).catch(err =>
            console.warn(`[TicketRepo] No se pudo notificar a Laravel (ticket #${ticket.id}):`, err?.message ?? err ?? 'error desconocido')
        );

        return ticket;
    }

    private notificarLaravel(ticketId: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const laravelUrl = process.env.LARAVEL_URL ?? 'http://192.168.100.20:8000';
            const url = new URL(`/api/chatbot/tickets/${ticketId}/notificar`, laravelUrl);
            const lib = url.protocol === 'https:' ? https : http;

            const req = lib.request(url, { method: 'POST' }, (res) => {
                res.resume(); // consumir respuesta para liberar memoria
                resolve();
            });
            req.on('error', reject);
            req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
            req.end();
        });
    }

    async actualizarEstado(id: number, estado_nuevo: string, comentario?: string): Promise<void> {
        await this.pool.query(
            `UPDATE tarea_desarrolladores SET estado_actual = $1, updated_at = NOW() WHERE id = $2`,
            [estado_nuevo, id]
        );
        await this.pool.query(
            `INSERT INTO tarea_desarrollador_estados
                (tarea_desarrollador_id, desarrollador_id, estado_anterior, estado_nuevo, comentario, estatus, created_at, updated_at)
             VALUES ($1, $2, NULL, $3, $4, 0, NOW(), NOW())`,
            [id, this.desarrolladorId, estado_nuevo, comentario ?? null]
        );
    }
}
