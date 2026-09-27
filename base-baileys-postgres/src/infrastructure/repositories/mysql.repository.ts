import { Pool } from 'pg';
import { Lead } from '../../domain/lead';
import LeadRepository from '../../domain/lead.repository';

class PostgresRepository implements LeadRepository {
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

    async save({ message, phone }: { message: string; phone: string }): Promise<Lead> {
        const lead = new Lead({ message, phone });
        await this.pool.query(
            'INSERT INTO whatsapp_mensajes (uuid, phone, message, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
            [lead.uuid, lead.phone, lead.message]
        );
        return lead;
    }

    async getDetail(id: string): Promise<Lead | null> {
        const result = await this.pool.query(
            'SELECT * FROM whatsapp_mensajes WHERE uuid = $1',
            [id]
        );
        if (!result.rows.length) return null;
        const row = result.rows[0];
        return new Lead({ message: row.message, phone: row.phone });
    }
}

export default PostgresRepository;
