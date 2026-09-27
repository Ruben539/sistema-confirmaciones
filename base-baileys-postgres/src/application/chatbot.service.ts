import { Pool } from 'pg';
import ConversacionRepository from '../domain/conversacion.repository';
import { Conversacion } from '../domain/conversacion';
import LeadExternal from '../domain/lead-external.repository';
import { TicketPostgresRepository } from '../infrastructure/repositories/ticket.postgres.repository';

// ─── Config por corporación ───────────────────────────────────────────────────

interface ChatbotConfig {
    desarrollador_id: number;
    nombre_sistema: string;
    saludo: string | null;
    opciones_habilitadas: string[]; // ['soporte', 'pedido', 'agente']
}

const CONFIG_DEFAULT: ChatbotConfig = {
    desarrollador_id: parseInt(process.env.SUPPORT_DESARROLLADOR_ID ?? '1'),
    nombre_sistema: 'Mambo',
    saludo: null,
    opciones_habilitadas: ['soporte', 'pedido', 'agente'],
};

// ─── Construcción de menú dinámico ────────────────────────────────────────────

function buildMenu(config: ChatbotConfig): string {
    const opciones = config.opciones_habilitadas;
    const items: string[] = [];
    if (opciones.includes('soporte')) items.push(`• *Soporte técnico* — contame tu problema`);
    if (opciones.includes('pedido'))  items.push(`• *Estado de pedido* — escribí "pedido"`);
    if (opciones.includes('agente'))  items.push(`• *Hablar con un agente* — escribí "agente"`);
    items.push(`• *Finalizar* — escribí "salir"`);

    const saludo = config.saludo ?? `¡Hola! 👋 Bienvenido al soporte de *${config.nombre_sistema}*.`;
    return `${saludo}\n\n¿En qué podemos ayudarte?\n\n${items.join('\n')}`;
}

// ─── Detección de intención ───────────────────────────────────────────────────

// const KEYWORDS: Record<string, string[]> = {
//     salir: [
//         'salir', 'chau', 'adios', 'adiós', 'bye', 'finalizar', 'cerrar',
//         'listo', 'ya esta', 'ya está', 'eso es todo', 'nada mas', 'nada más',
//         'gracias', 'ok gracias', 'muchas gracias',
//     ],
//     menu: [
//         'hola', 'alo', 'buenas', 'buen dia', 'buenos dias', 'buen día', 'buenos días',
//         'inicio', 'menu', 'menú', 'start', 'comenzar', 'empezar',
//         'que podes hacer', 'qué podés hacer', 'ayudame', 'ayúdame',
//     ],
//     soporte: [
//         'soporte', 'ayuda', 'problema', 'error', 'fallo', 'falla', 'bug',
//         'no funciona', 'no anda', 'no abre', 'no carga', 'no deja', 'no puedo',
//         'no me deja', 'no me permite', 'no me aparece', 'se cae', 'se traba',
//         'se congela', 'se cierra', 'crashea', 'tarda', 'lento', 'trabado', 'colgado',
//         'no sincroniza', 'no actualiza', 'perdí', 'perdi', 'borró', 'borro',
//         'roto', 'rompió', 'rompio', 'dejo de', 'dejó de', 'no responde',
//     ],
//     pedido: [
//         'pedido', 'estado', 'seguimiento', 'orden', 'envio', 'envío',
//         'donde esta', 'dónde está', 'cuando llega', 'cuándo llega',
//         'rastreo', 'tracking', 'paquete', 'entrega', 'despacho',
//     ],
//     agente: [
//         'agente', 'humano', 'persona', 'asesor', 'operador',
//         'hablar con', 'quiero hablar', 'necesito hablar',
//         'me comuniques', 'pasar con',
//     ],
//     acceso: [
//         'login', 'contraseña', 'clave', 'usuario', 'no puedo entrar', 
//         'bloqueado', 'bloqueada', 'olvide', 'olvidé', 'ingresar', 'entrar', 
//         'acceder', 'registro', 'cuenta', 'token'
//     ],
//     consulta: [
//         'como se hace', 'cómo se hace', 'donde veo', 'dónde veo', 'tutorial', 
//         'manual', 'capacitacion', 'capacitación', 'guia', 'guía', 'duda', 'pregunta'
//     ]
// };


const KEYWORDS: Record<string, string[]> = {
    salir: [
        'salir', 'chau', 'adios', 'adiós', 'bye', 'finalizar', 'cerrar',
        'listo', 'ya esta', 'ya está', 'eso es todo', 'nada mas', 'nada más',
        'gracias', 'ok gracias', 'muchas gracias', 'solucionado', 'resuelto', 
        'ya funciono', 'ya funcionó', 'quedo', 'quedó', 'terminar'
    ],
    menu: [
        'hola', 'alo', 'buenas', 'buen dia', 'buenos dias', 'buen día', 'buenos días',
        'buenas tardes', 'buenas noches', 'hey', 'q tal', 'que tal', 'inicio', 
        'menu', 'menú', 'start', 'comenzar', 'empezar', 'que podes hacer', 
        'qué podés hacer', 'ayudame', 'ayúdame', '?', 'principal'
    ],
    soporte: [
        'soporte', 'ayuda', 'problema', 'error', 'fallo', 'falla', 'bug',
        'no funciona', 'no anda', 'no abre', 'no carga', 'no deja', 'no puedo',
        'no me deja', 'no me permite', 'no me aparece', 'se cae', 'se traba',
        'se congela', 'se cierra', 'crashea', 'tarda', 'lento', 'trabado', 'colgado',
        'no sincroniza', 'no actualiza', 'perdí', 'perdi', 'borró', 'borro',
        'roto', 'rompió', 'rompio', 'dejo de', 'dejó de', 'no responde',
        // Casos críticos para Merchandisers (Hardware, Red y App)
        'foto', 'camara', 'cámara', 'gps', 'ubicacion', 'ubicación', 'señal', 
        'internet', 'datos', 'wifi', 'wi-fi', 'memoria', 'lleno', 'almacenamiento', 
        'descargar', 'instalar', 'actualizar', 'apk', 'bateria', 'batería'
    ],
    acceso: [
        // Nueva categoría: Problemas de ingreso y contraseñas
        'login', 'contraseña', 'contrasena', 'clave', 'usuario', 'no puedo entrar', 
        'bloqueado', 'bloqueada', 'olvide', 'olvidé', 'ingresar', 'entrar', 
        'acceder', 'registro', 'cuenta', 'token', 'pin', 'contrasenia'
    ],
    consulta: [
        // Nueva categoría: Dudas de uso o capacitación
        'como se hace', 'cómo se hace', 'donde veo', 'dónde veo', 'tutorial', 
        'manual', 'capacitacion', 'capacitación', 'guia', 'guía', 'duda', 
        'pregunta', 'como uso', 'cómo uso', 'explicame', 'cómo funciona'
    ],
    pedido: [
        'pedido', 'estado', 'seguimiento', 'orden', 'envio', 'envío',
        'donde esta', 'dónde está', 'cuando llega', 'cuándo llega',
        'rastreo', 'tracking', 'paquete', 'entrega', 'despacho', 'remito', 'factura'
    ],
    agente: [
        'agente', 'humano', 'persona', 'asesor', 'operador',
        'hablar con', 'quiero hablar', 'necesito hablar',
        'me comuniques', 'pasar con', 'soporte tecnico', 'atencion al cliente'
    ],
};

function detectarIntent(texto: string, config: ChatbotConfig): string | null {
    const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const opciones = config.opciones_habilitadas;

    // Buscar por keywords — respetando solo las opciones habilitadas
    if (KEYWORDS.salir.some(kw => t === kw || t.includes(kw)))  return 'salir';
    if (KEYWORDS.menu.some(kw => t === kw || t.includes(kw)))   return 'menu';
    if (opciones.includes('soporte') && KEYWORDS.soporte.some(kw => t.includes(kw))) return 'soporte';
    if (opciones.includes('pedido')  && KEYWORDS.pedido.some(kw => t.includes(kw)))  return 'pedido';
    if (opciones.includes('agente')  && KEYWORDS.agente.some(kw => t.includes(kw)))  return 'agente';

    // Mensaje largo sin match → asumir descripción de problema (si soporte está habilitado)
    if (opciones.includes('soporte') && t.split(' ').length >= 5) return 'descripcion_directa';

    return null;
}

// ─── Timeout de inactividad ───────────────────────────────────────────────────

// Horas de inactividad antes de considerar la conversación expirada
const TIMEOUT_HORAS = parseInt(process.env.CONVERSATION_TIMEOUT_HOURS ?? '24');
const TIMEOUT_SEGUNDOS = TIMEOUT_HORAS * 3600;

// ─── Servicio ─────────────────────────────────────────────────────────────────

const SOLICITUD_SATISFACCION = `✅ Conversación finalizada.\n\nAntes de cerrar, ¿podés calificar tu experiencia?\n\nRespondé con un número del *1 al 5*:\n⭐ 1 - Muy insatisfecho\n⭐⭐ 2 - Insatisfecho\n⭐⭐⭐ 3 - Neutral\n⭐⭐⭐⭐ 4 - Satisfecho\n⭐⭐⭐⭐⭐ 5 - Muy satisfecho`;

function esDescripcionVaga(texto: string): boolean {
    const t = texto.trim();
    if (t.length < 15) return true;
    if (t.split(/\s+/).length < 3) return true;
    return false;
}

export class ChatbotService {
    private pool: Pool;
    // Imágenes pendientes de adjuntar al ticket (conv.id → ruta en disco)
    private pendingImages = new Map<number, string>();
    // Contador de descripciones vagas por conversación (conv.id → intentos)
    private intentosDesc = new Map<number, number>();

    constructor(
        private repo: ConversacionRepository,
        private transporter: LeadExternal,
        private ticketRepo: TicketPostgresRepository
    ) {
        this.pool = new Pool({
            host: process.env.DB_HOST ?? '127.0.0.1',
            port: parseInt(process.env.DB_PORT ?? '5432'),
            database: process.env.DB_DATABASE ?? 'eventos',
            user: process.env.DB_USERNAME ?? 'postgres',
            password: String(process.env.DB_PASSWORD ?? ''),
        });
    }

    // Carga la config de chatbot para la corporación. Si no existe, usa defaults.
    private async cargarConfig(corporacion_id?: number): Promise<ChatbotConfig> {
        if (!corporacion_id) return CONFIG_DEFAULT;
        const result = await this.pool.query(
            `SELECT desarrollador_id, nombre_sistema, saludo, opciones_habilitadas
             FROM chatbot_configuraciones
             WHERE corporacion_id = $1 AND activo = true
             LIMIT 1`,
            [corporacion_id]
        );
        if (!result.rows.length) return CONFIG_DEFAULT;
        const row = result.rows[0];
        return {
            desarrollador_id: row.desarrollador_id,
            nombre_sistema: row.nombre_sistema,
            saludo: row.saludo,
            opciones_habilitadas: Array.isArray(row.opciones_habilitadas)
                ? row.opciones_habilitadas
                : JSON.parse(row.opciones_habilitadas),
        };
    }

    // Normaliza el número de WhatsApp a distintos formatos para buscar en la BD.
    // WhatsApp envía 595974329195; la BD puede tener 0974329195, 974329195 o 595974329195.
    private phoneVariants(phone: string): string[] {
        const variants = new Set<string>();
        variants.add(phone);

        // Si empieza con código de país 595 (Paraguay)
        if (phone.startsWith('595')) {
            const sinCodigo = phone.slice(3); // 974329195
            variants.add(sinCodigo);
            variants.add('0' + sinCodigo); // 0974329195
        }
        // Si empieza con 0 (formato local)
        if (phone.startsWith('0')) {
            const sinCero = phone.slice(1); // 974329195
            variants.add(sinCero);
            variants.add('595' + sinCero); // 595974329195
        }
        return Array.from(variants);
    }

    private async buscarMerchandiser(phone: string): Promise<{ id: number; corporacion_id: number } | null> {
        const variants = this.phoneVariants(phone);
        const conditions = variants.map((_, i) => `m.telefono = $${i + 1}`).join(' OR ');
        const params = variants;

        const result = await this.pool.query(
            `SELECT m.id, g.corporacion_id
             FROM merchandisers m
             JOIN categorias c ON c.id = m.categoria_id
             JOIN grupos g ON g.id = c.grupo_id
             WHERE (${conditions}) AND m.estatus = 0
             ORDER BY m.id DESC
             LIMIT 1`,
            params
        );
        if (!result.rows.length) return null;
        return result.rows[0] as { id: number; corporacion_id: number };
    }

    private estadoLabel(estado: string): string {
        const map: Record<string, string> = {
            pendiente:    '⏳ Pendiente',
            en_progreso:  '🔄 En progreso',
            en_revision:  '🔍 En revisión',
            bloqueada:    '🚫 Bloqueado',
            finalizado:   '✅ Finalizado',
        };
        return map[estado] ?? estado;
    }

    private async consultarTicketsUsuario(phone: string): Promise<string> {
        const result = await this.pool.query(
            `SELECT
                td.id,
                td.name,
                td.estado_actual,
                td.prioridad,
                td.created_at,
                d.name AS desarrollador_nombre,
                (SELECT tde.comentario
                 FROM tarea_desarrollador_estados tde
                 WHERE tde.tarea_desarrollador_id = td.id
                 ORDER BY tde.id DESC LIMIT 1) AS ultimo_comentario,
                (SELECT tde.created_at
                 FROM tarea_desarrollador_estados tde
                 WHERE tde.tarea_desarrollador_id = td.id
                 ORDER BY tde.id DESC LIMIT 1) AS ultima_actualizacion
             FROM tarea_desarrolladores td
             JOIN desarrolladores d ON d.id = td.desarrollador_id
             WHERE td.id IN (
                 SELECT tarea_desarrollador_id FROM conversaciones
                 WHERE phone = $1 AND tarea_desarrollador_id IS NOT NULL
             )
             AND td.estatus = 0
             ORDER BY td.created_at DESC
             LIMIT 5`,
            [phone]
        );

        if (!result.rows.length) {
            return `📋 *Consulta de Tickets*\n\nNo encontramos tickets registrados para tu número.\n\nSi tenés un problema escribí *soporte* para crear uno.\nEscribí *menu* para volver al inicio.`;
        }

        const lineas = result.rows.map((t: any) => {
            const fecha = new Date(t.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' });
            const estado = this.estadoLabel(t.estado_actual);
            const atiende = `👤 ${t.desarrollador_nombre}`;
            const comentario = t.ultimo_comentario ? `\n   💬 _${t.ultimo_comentario}_` : '';
            const actualizacion = t.ultima_actualizacion
                ? ` (${new Date(t.ultima_actualizacion).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })})`
                : '';
            return `*#${t.id}* · ${fecha} · ${estado}${actualizacion}\n   ${atiende}${comentario}\n   📝 ${t.name}`;
        });

        return `📋 *Tus Tickets de Soporte*\n\n${lineas.join('\n\n')}\n\nEscribí *menu* para volver al inicio.`;
    }

    async processMessage(phone: string, mensaje: string, groupJid?: string, isMentioned?: boolean, mediaType?: string, mediaPath?: string, replyJid?: string): Promise<void> {
        try {
            let conversacion = await this.repo.findActiveByPhone(phone, groupJid);

            if (groupJid && !conversacion && !isMentioned) return;
            if (mediaType && !mensaje && !conversacion) return;

            if (!conversacion) {
                const merchandiser = await this.buscarMerchandiser(phone);
                conversacion = await this.repo.create(phone, groupJid, merchandiser?.id, merchandiser?.corporacion_id);
            }

            // Cargar config de la corporación para personalizar el flujo
            const config = await this.cargarConfig(conversacion.corporacion_id ?? undefined);

            // Detectar inactividad: si el último mensaje supera el timeout, cerrar y reiniciar
            const ultimoMensajeCheck = await this.repo.ultimoMensaje(conversacion.id);
            if (ultimoMensajeCheck) {
                const segInactivo = Math.floor((new Date().getTime() - ultimoMensajeCheck.getTime()) / 1000);
                if (segInactivo > TIMEOUT_SEGUNDOS) {
                    await this.repo.cerrar(conversacion.id, segInactivo);
                    const merchandiser = await this.buscarMerchandiser(phone);
                    conversacion = await this.repo.create(phone, groupJid, merchandiser?.id, merchandiser?.corporacion_id);
                    const aviso = `⏱ Tu sesión anterior expiró por inactividad.\n\n${buildMenu(config)}`;
                    await this.repo.guardarMensaje(conversacion.id, 'saliente', 'bot', aviso);
                    await this.transporter.sendMsg({ phone, message: aviso, groupJid, replyJid });
                    return;
                }
            }

            const ahora = new Date();
            const ultimoMensaje = await this.repo.ultimoMensaje(conversacion.id);
            const segDesdeAnterior = ultimoMensaje
                ? Math.floor((ahora.getTime() - ultimoMensaje.getTime()) / 1000)
                : undefined;

            await this.repo.guardarMensaje(conversacion.id, 'entrante', 'cliente', mensaje || `[${mediaType}]`, segDesdeAnterior);

            // ── Etapa: esperando calificación ──────────────────────────────
            if (conversacion.etapa === 'esperando_calificacion') {
                if (mediaType && !mensaje) {
                    await this.responder(conversacion, phone, groupJid,
                        `Por favor respondé con un número del *1 al 5* para calificar tu experiencia.`, replyJid);
                    return;
                }
                await this.procesarCalificacion(conversacion, mensaje, groupJid, replyJid);
                return;
            }

            // ── Etapa: ticket ya creado ────────────────────────────────────
            if (conversacion.etapa === 'ticket_creado') {
                const intent = detectarIntent(mensaje, config);
                if (intent !== 'salir' && intent !== 'menu' && intent !== 'pedido') {
                    const ticketId = conversacion.tarea_desarrollador_id;
                    await this.responder(conversacion, phone, groupJid,
                        `Tu ticket${ticketId ? ` *#${ticketId}*` : ''} ya está registrado y siendo atendido. 🔄\n\nPara una atención más rápida, *finalizá la conversación*:\n\n• Escribí *consultar* para ver el estado\n• Escribí *finalizar* para cerrar y calificar`, replyJid);
                    return;
                }
            }

            // ── Etapa: esperando descripción ───────────────────────────────
            if (conversacion.etapa === 'esperando_descripcion') {
                if (mediaType === 'imagen') {
                    if (mediaPath) this.pendingImages.set(conversacion.id, mediaPath);
                    if (!mensaje) {
                        await this.responder(conversacion, phone, groupJid,
                            `📸 Imagen recibida, la adjuntaremos al ticket.\n\nAhora describí el problema en texto para que podamos procesarlo.`, replyJid);
                        return;
                    }
                }

                if (mediaType && mediaType !== 'imagen' && !mensaje) {
                    await this.responder(conversacion, phone, groupJid,
                        `Recibimos tu *${mediaType}* 👍\n\nPero para crear el ticket necesitamos que describas el problema en *texto*.`, replyJid);
                    return;
                }

                if (esDescripcionVaga(mensaje)) {
                    const intentos = (this.intentosDesc.get(conversacion.id) ?? 0) + 1;
                    this.intentosDesc.set(conversacion.id, intentos);
                    if (intentos < 3) {
                        await this.responder(conversacion, phone, groupJid,
                            `Necesitamos un poco más de detalle para ayudarte mejor. 🙏\n\n¿Podés indicarnos?\n• ¿Qué pantalla o función falla?\n• ¿Qué mensaje de error aparece?\n• ¿Desde cuándo ocurre?\n\n_Intento ${intentos} de 2 — al tercero creamos el ticket igual._`, replyJid);
                        return;
                    }
                }

                const imagePath = this.pendingImages.get(conversacion.id) ?? mediaPath;
                this.pendingImages.delete(conversacion.id);
                this.intentosDesc.delete(conversacion.id);
                await this.crearTicketYResponder(conversacion, mensaje, ahora, groupJid, config, imagePath, replyJid);
                return;
            }

            // ── Multimedia sin etapa activa ────────────────────────────────
            if (mediaType && !mensaje) {
                await this.responder(conversacion, phone, groupJid,
                    `Solo proceso mensajes de texto. 📝\n\nEscribí *menu* para ver las opciones disponibles.`, replyJid);
                return;
            }

            // ── Detección de intención (con opciones de la corporación) ────
            const intent = detectarIntent(mensaje, config);

            if (!conversacion.tiempo_primera_respuesta_seg && segDesdeAnterior !== undefined) {
                await this.repo.guardarTiempoRespuesta(conversacion.id, segDesdeAnterior);
            }

            switch (intent) {
                case 'menu':
                    await this.responder(conversacion, phone, groupJid, buildMenu(config), replyJid);
                    break;

                case 'soporte':
                    await this.repo.actualizarCategoria(conversacion.id, 'soporte_tecnico');
                    await this.repo.actualizarEtapa(conversacion.id, 'esperando_descripcion');
                    await this.responder(conversacion, phone, groupJid,
                        `🔧 *Soporte Técnico - ${config.nombre_sistema}*\n\nDescribí tu problema con el mayor detalle posible.\n\n_Tu mensaje generará un ticket automáticamente._`, replyJid);
                    break;

                case 'descripcion_directa':
                    await this.repo.actualizarCategoria(conversacion.id, 'soporte_tecnico');
                    await this.crearTicketYResponder(conversacion, mensaje, ahora, groupJid, config, undefined, replyJid);
                    break;

                case 'pedido': {
                    await this.repo.actualizarCategoria(conversacion.id, 'consulta_estado');
                    const respuestaPedido = await this.consultarTicketsUsuario(phone);
                    await this.responder(conversacion, phone, groupJid, respuestaPedido, replyJid);
                    break;
                }

                case 'agente': {
                    await this.repo.actualizarCategoria(conversacion.id, 'derivado_agente');
                    await this.repo.actualizarEstatus(conversacion.id, 'derivado');
                    await this.responder(conversacion, phone, groupJid,
                        `📞 *Contactando con soporte...*\n\nTu solicitud fue registrada. Un agente se comunicará con vos a la brevedad.\n\n🕐 Lunes a Viernes de 8:00 a 18:00 hs.`, replyJid);
                    const supportPhone = process.env.SUPPORT_PHONE;
                    if (supportPhone) {
                        await this.transporter.sendMsg({
                            phone: supportPhone,
                            message: `🔔 *Solicitud de atención*\n\nEl número *${phone}* solicita hablar con un agente.\n\nConversación activa en el sistema.`,
                        });
                    }
                    break;
                }

                case 'salir': {
                    await this.repo.actualizarEtapa(conversacion.id, 'esperando_calificacion');
                    await this.responder(conversacion, phone, groupJid, SOLICITUD_SATISFACCION, replyJid);
                    break;
                }

                default: {
                    const opciones = config.opciones_habilitadas;
                    const items: string[] = [];
                    if (opciones.includes('soporte')) items.push(`• Contame tu problema técnico`);
                    if (opciones.includes('pedido'))  items.push(`• Escribí "pedido" para consultar un pedido`);
                    if (opciones.includes('agente'))  items.push(`• Escribí "agente" para hablar con alguien`);
                    items.push(`• Escribí "salir" para finalizar`);
                    await this.responder(conversacion, phone, groupJid,
                        `No entendí bien tu mensaje. 🤔\n\n¿Qué necesitás?\n\n${items.join('\n')}`, replyJid);
                    break;
                }
            }

        } catch (error) {
            console.error('[ChatbotService] Error procesando mensaje:', error);
        }
    }

    private async responder(conversacion: Conversacion, phone: string, groupJid: string | undefined, texto: string, replyJid?: string): Promise<void> {
        await this.repo.guardarMensaje(conversacion.id, 'saliente', 'bot', texto);
        await this.transporter.sendMsg({ phone, message: texto, groupJid, replyJid });
    }

    private async crearTicketYResponder(conversacion: Conversacion, descripcion: string, ahora: Date, groupJid: string | undefined, config: ChatbotConfig, archivoPath?: string, replyJid?: string): Promise<void> {
        const ticket = await this.ticketRepo.crear(conversacion.phone, descripcion, 'media', config.desarrollador_id, archivoPath);

        await this.repo.vincularTicket(conversacion.id, ticket.id);
        await this.repo.actualizarEtapa(conversacion.id, 'ticket_creado');

        if (!conversacion.tiempo_primera_respuesta_seg) {
            const inicio = conversacion.created_at ? new Date(conversacion.created_at) : ahora;
            const segs = Math.floor((ahora.getTime() - inicio.getTime()) / 1000);
            await this.repo.guardarTiempoRespuesta(conversacion.id, segs);
        }

        const respuesta = `✅ *Ticket #${ticket.id} creado*\n\n📋 Problema registrado:\n_${descripcion.substring(0, 100)}${descripcion.length > 100 ? '...' : ''}_\n\nTe avisaremos cuando haya novedades. Escribí *menu* para volver al inicio.`;
        await this.responder(conversacion, conversacion.phone, groupJid, respuesta, replyJid);
    }

    private parsearCalificacion(mensaje: string): number | null {
        const n = parseInt(mensaje.trim());
        if (!isNaN(n) && n >= 1 && n <= 5) return n;
        const t = mensaje.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
        if (t.includes('muy satisfecho') || t.includes('excelente') || t.includes('perfecto') || t.includes('muy bien')) return 5;
        if (t.includes('satisfecho') || t.includes('bien') || t.includes('bueno')) return 4;
        if (t.includes('neutral') || t.includes('regular') || t.includes('mas o menos') || t.includes('normal')) return 3;
        if (t.includes('muy insatisfecho') || t.includes('pesimo') || t.includes('terrible') || t.includes('muy mal')) return 1;
        if (t.includes('insatisfecho') || t.includes('mal') || t.includes('malo')) return 2;
        return null;
    }

    private async procesarCalificacion(conversacion: Conversacion, mensaje: string, groupJid?: string, replyJid?: string): Promise<void> {
        const calificacion = this.parsearCalificacion(mensaje);
        if (calificacion !== null) {
            await this.repo.guardarSatisfaccion(conversacion.id, calificacion);
            const ahora = new Date();
            const inicio = conversacion.created_at ? new Date(conversacion.created_at) : ahora;
            const segResolucion = Math.floor((ahora.getTime() - inicio.getTime()) / 1000);
            await this.repo.cerrar(conversacion.id, segResolucion);
            const estrellas = '⭐'.repeat(calificacion);
            await this.responder(conversacion, conversacion.phone, groupJid,
                `${estrellas} ¡Gracias por tu calificación!\n\nTu opinión nos ayuda a mejorar. ¡Hasta pronto!`, replyJid);
        } else {
            await this.responder(conversacion, conversacion.phone, groupJid,
                `Por favor respondé con un número del *1 al 5* para calificar tu experiencia.\n\n⭐ 1 · ⭐⭐ 2 · ⭐⭐⭐ 3 · ⭐⭐⭐⭐ 4 · ⭐⭐⭐⭐⭐ 5`, replyJid);
        }
    }
}
