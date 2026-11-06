import cron from 'node-cron';
import { ClienteModel } from '../models/Clientes/clienteTipado';
import { esCumpleanos, hoyEnZona, ZONA_HORARIA } from '../lib/edad';
import { correoConfigurado, enviarCorreo } from '../models/Clientes/mailer';

const gimnasio = () => process.env.GYM_NOMBRE || 'Tu Gimnasio';

const escapar = (texto: string) =>
    texto.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function armarMensaje(nombre: string) {
    const gym = gimnasio();
    return {
        subject: `¡Feliz cumpleaños, ${nombre}!`,
        text: `¡Feliz cumpleaños, ${nombre}! ${gym} te desea un lindo cumpleaños. 🎉`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;text-align:center">
            <h1 style="margin:0 0 12px">🎉 ¡Feliz cumpleaños, ${escapar(nombre)}! 🎂</h1>
            <p style="font-size:16px;color:#374151;margin:0">${escapar(gym)} te desea un lindo cumpleaños.</p>
          </div>`,
    };
}

/**
 * Manda la felicitación si el cliente cumple años hoy y aún no se le ha mandado este año.
 * Nunca lanza error: si algo falla solo lo registra en consola y devuelve false.
 * Primero "reserva" el envío en la base (ultimoSaludoCumple = año actual) para que no se
 * duplique si se llama dos veces a la vez, y lo revierte si el correo no sale.
 */
export async function felicitarSiCumple(cliente: any): Promise<boolean> {
    try {
        if (!cliente?.correo || cliente.estatus !== 'activo') return false;
        const hoy = hoyEnZona();
        if (!esCumpleanos(cliente.fechaNacimiento, hoy)) return false;
        if (!correoConfigurado()) {
            console.warn('[cumpleaños] SMTP sin configurar: no se envió la felicitación.');
            return false;
        }

        const previo = await ClienteModel.findOneAndUpdate(
            { _id: cliente._id, ultimoSaludoCumple: { $ne: hoy.y } },
            { ultimoSaludoCumple: hoy.y },
        );
        if (!previo) return false; // ya se le felicitó este año

        try {
            await enviarCorreo({ to: cliente.correo, ...armarMensaje(cliente.nombre) });
            return true;
        } catch (err) {
            const valorAnterior = (previo as any).ultimoSaludoCumple;
            await ClienteModel.updateOne(
                { _id: cliente._id },
                valorAnterior == null
                    ? { $unset: { ultimoSaludoCumple: 1 } }
                    : { ultimoSaludoCumple: valorAnterior },
            );
            throw err;
        }
    } catch (err) {
        console.error('[cumpleaños] No se pudo enviar la felicitación:', err instanceof Error ? err.message : err);
        return false;
    }
}

/** Revisa a todos los clientes activos y felicita a quienes cumplen años hoy. */
export async function enviarFelicitacionesHoy(): Promise<number> {
    const hoy = hoyEnZona();
    const candidatos = await ClienteModel.find({
        estatus: 'activo',
        correo: { $nin: [null, ''] },
        fechaNacimiento: { $nin: [null, ''] },
        ultimoSaludoCumple: { $ne: hoy.y },
    }).lean();

    let enviados = 0;
    for (const c of candidatos as any[]) {
        if (!esCumpleanos(c.fechaNacimiento, hoy)) continue;
        if (await felicitarSiCumple(c)) enviados++;
    }
    if (enviados) console.log(`[cumpleaños] ${enviados} felicitación(es) enviada(s).`);
    return enviados;
}

/**
 * Programa el envío diario (por defecto 9:00 a.m. en la zona horaria del negocio, configurable
 * con CUMPLE_CRON) y hace una pasada al arrancar por si el servidor estuvo apagado a esa hora.
 * Llamar una sola vez, cuando Mongo ya esté conectado.
 */
export function iniciarCumpleanos(): void {
    const expresion = process.env.CUMPLE_CRON || '0 9 * * *';
    cron.schedule(expresion, () => { void enviarFelicitacionesHoy().catch(e => console.error('[cumpleaños]', e)); }, { timezone: ZONA_HORARIA });
    setTimeout(() => { void enviarFelicitacionesHoy().catch(e => console.error('[cumpleaños]', e)); }, 10_000);
    console.log(`[cumpleaños] Envío diario programado (${expresion}, ${ZONA_HORARIA}).`);
}