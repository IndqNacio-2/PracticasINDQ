import { randomInt } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { isValidObjectId, type Model } from 'mongoose';
import { Reservacion } from '../models/Reservaciones/reservacion';
import { ClienteModel } from '../models/Clientes/clienteTipado';
import { parseFechaISO, ZONA_HORARIA } from '../lib/edad';

// Reglas de negocio de las reservaciones (sección 3.1.5):
//  - Cada reservación recibe un código/folio único.
//  - Reagendar: solo una vez y sin costo. Quien no asistió no puede reagendar.
//  - Cancelar: hasta 24 horas antes de la clase y sin reembolso.
//  - Inasistencia: sin reembolso y sin reagendar.
// El personal puede saltarse las reglas de tiempo/cantidad con `forzar: true`; el cliente (app móvil) no.

/** Horas mínimas de anticipación para cancelar. Cámbialo aquí si la regla es otra. */
export const HORAS_LIMITE_CANCELACION = 24;

const ESTATUS = ['pendiente', 'confirmada', 'cancelada', 'no_asistio'];
const ESTATUS_ACTIVOS = ['pendiente', 'confirmada'];
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para evitar confusiones

// Se tipa suelto a propósito: los filtros con $in/$ne sobre un enum chocan con los tipos inferidos.
const Reservaciones = Reservacion as unknown as Model<any>;

export class ReglaError extends Error {
    status: number;
    constructor(mensaje: string, status = 400) {
        super(mensaje);
        this.status = status;
    }
}

/** Manejador de errores de reglas de negocio. Va antes de `manejarErrores` en cada router. */
export function manejarReglas(err: any, _req: Request, res: Response, next: NextFunction) {
    if (err instanceof ReglaError) return res.status(err.status).json({ error: err.message });
    next(err);
}

export interface DatosHorario {
    idHorario: string;
    clase: string;
    entrenador: string;
    horaClase: string;
    fechaReservacion: string;
}

// ---------- Utilidades ----------

const generarCodigo = () =>
    'RES-' + Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

/** Instante real de la clase, interpretando fecha y hora en la zona horaria del negocio. */
function instanteClase(fecha: string, hora: string, tz: string = ZONA_HORARIA): Date | null {
    const f = parseFechaISO(fecha);
    const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp])?\.?[Mm]?\.?$/.exec(String(hora).trim());
    if (!f || !m) return null;
    let h = Number(m[1]);
    const min = Number(m[2]);
    if (m[3]) h = (h % 12) + (m[3].toLowerCase() === 'p' ? 12 : 0);
    if (h > 23 || min > 59) return null;

    const supuesto = Date.UTC(f.y, f.m - 1, f.d, h, min);
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(supuesto));
    const n = (tipo: string) => Number(partes.find(p => p.type === tipo)?.value);
    const comoLocal = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'));
    return new Date(supuesto - (comoLocal - supuesto));
}

function texto(valor: unknown, campo: string): string {
    if (typeof valor !== 'string' || !valor.trim() || valor.length > 150) {
        throw new ReglaError(`${campo} es obligatorio`);
    }
    return valor.trim();
}

/** Valida los datos del horario (el front los arma a partir del horario elegido). */
function validarHorario(body: any): DatosHorario {
    const datos: DatosHorario = {
        idHorario: texto(body?.idHorario, 'El horario'),
        clase: texto(body?.clase, 'La clase'),
        entrenador: texto(body?.entrenador, 'El entrenador'),
        horaClase: texto(body?.horaClase, 'La hora de la clase'),
        fechaReservacion: texto(body?.fechaReservacion, 'La fecha de la clase'),
    };
    if (!parseFechaISO(datos.fechaReservacion)) throw new ReglaError('La fecha de la clase debe tener formato AAAA-MM-DD');
    const instante = instanteClase(datos.fechaReservacion, datos.horaClase);
    if (!instante) throw new ReglaError('La hora de la clase no es válida (usa HH:mm)');
    if (instante.getTime() <= Date.now()) throw new ReglaError('La clase ya pasó o ya inició');
    return datos;
}

async function buscar(id: string, idCliente?: string): Promise<any> {
    if (!isValidObjectId(id)) throw new ReglaError('ID de reservación inválido');
    const reservacion = await Reservaciones.findOne({ _id: id, ...(idCliente ? { idCliente } : {}) });
    if (!reservacion) throw new ReglaError('Reservación no encontrada', 404);
    return reservacion;
}

async function verificarSinDuplicado(idCliente: string, idHorario: string, excluirId?: string) {
    const existe = await Reservaciones.exists({
        idCliente,
        idHorario,
        estatus: { $in: ESTATUS_ACTIVOS },
        ...(excluirId ? { _id: { $ne: excluirId } } : {}),
    });
    if (existe) throw new ReglaError('El cliente ya tiene una reservación activa en ese horario', 409);
}

// ---------- Consulta ----------

export async function listarReservaciones(query: Record<string, unknown> = {}) {
    const filtro: Record<string, any> = {};
    const cadena = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    if (cadena(query.idCliente)) filtro.idCliente = cadena(query.idCliente);
    if (cadena(query.idHorario)) filtro.idHorario = cadena(query.idHorario);
    if (cadena(query.fecha)) filtro.fechaReservacion = cadena(query.fecha);
    if (cadena(query.codigo)) filtro.codigo = cadena(query.codigo)!.toUpperCase();
    const estatus = cadena(query.estatus);
    if (estatus && ESTATUS.includes(estatus)) filtro.estatus = estatus;
    return Reservaciones.find(filtro).sort({ fechaReservacion: -1, horaClase: -1 }).limit(500);
}

export const buscarPorId = (id: string, idCliente?: string) => buscar(id, idCliente);

export async function buscarPorCodigo(codigo: string, idCliente?: string) {
    const reservacion = await Reservaciones.findOne({
        codigo: String(codigo).trim().toUpperCase(),
        ...(idCliente ? { idCliente } : {}),
    });
    if (!reservacion) throw new ReglaError('Reservación no encontrada', 404);
    return reservacion;
}

// ---------- Alta ----------

export async function crearReservacion(body: any, idCliente: string, estatusInicial?: unknown) {
    if (!isValidObjectId(idCliente)) throw new ReglaError('ID de cliente inválido');
    const cliente: any = await ClienteModel.findById(idCliente);
    if (!cliente) throw new ReglaError('Cliente no encontrado', 404);
    if (cliente.estatus !== 'activo') throw new ReglaError('El cliente está dado de baja', 403);

    const horario = validarHorario(body);
    await verificarSinDuplicado(String(cliente._id), horario.idHorario);

    for (let intento = 0; intento < 5; intento++) {
        try {
            return await Reservaciones.create({
                ...horario,
                codigo: generarCodigo(),
                idCliente: String(cliente._id),
                nombreCliente: `${cliente.nombre} ${cliente.apellidos}`.trim(),
                estatus: estatusInicial === 'confirmada' ? 'confirmada' : 'pendiente',
                asistenciaConfirmada: false,
            });
        } catch (err: any) {
            if (err?.code === 11000 && err?.keyPattern?.codigo) continue; // código repetido: se genera otro
            throw err;
        }
    }
    throw new Error('No se pudo generar un código de reservación único');
}

// ---------- Edición ----------

/** Cambia entre pendiente y confirmada. Cancelar, reagendar y asistencia tienen su propia acción. */
export async function cambiarEstatus(id: string, estatus: unknown) {
    if (estatus !== 'pendiente' && estatus !== 'confirmada') {
        throw new ReglaError('Solo se puede cambiar a pendiente o confirmada. Para cancelar usa la acción de cancelar.');
    }
    const actual = await buscar(id);
    if (!ESTATUS_ACTIVOS.includes(actual.estatus)) {
        throw new ReglaError(`No se puede modificar una reservación ${actual.estatus === 'cancelada' ? 'cancelada' : 'con inasistencia'}`, 409);
    }
    actual.estatus = estatus;
    await actual.save();
    return actual;
}

export async function marcarAsistencia(id: string) {
    const actual = await buscar(id);
    if (!ESTATUS_ACTIVOS.includes(actual.estatus)) {
        throw new ReglaError('Solo se puede registrar la asistencia de una reservación vigente', 409);
    }
    actual.estatus = 'confirmada';
    actual.asistenciaConfirmada = true;
    await actual.save();
    return actual;
}

export async function marcarInasistencia(id: string) {
    const actual = await buscar(id);
    if (!ESTATUS_ACTIVOS.includes(actual.estatus) || actual.asistenciaConfirmada) {
        throw new ReglaError('Solo se puede marcar inasistencia en una reservación vigente sin asistencia', 409);
    }
    const instante = instanteClase(actual.fechaReservacion, actual.horaClase);
    if (instante && instante.getTime() > Date.now()) {
        throw new ReglaError('La clase aún no ha iniciado', 409);
    }
    actual.estatus = 'no_asistio';
    await actual.save();
    return actual;
}

// ---------- Baja (cancelación) ----------

export async function cancelarReservacion(id: string, opciones: { forzar?: boolean; idCliente?: string } = {}) {
    const actual = await buscar(id, opciones.idCliente);
    if (actual.estatus === 'cancelada') throw new ReglaError('La reservación ya está cancelada', 409);
    if (actual.estatus === 'no_asistio') throw new ReglaError('No se puede cancelar: el cliente no asistió a su clase. No hay reembolso.', 409);
    if (actual.asistenciaConfirmada) throw new ReglaError('No se puede cancelar: el cliente ya asistió a la clase', 409);

    if (!opciones.forzar) {
        const instante = instanteClase(actual.fechaReservacion, actual.horaClase);
        if (!instante) throw new ReglaError('No se pudo determinar la hora de la clase. Contacta al gimnasio.');
        const horas = (instante.getTime() - Date.now()) / 3_600_000;
        if (horas < HORAS_LIMITE_CANCELACION) {
            throw new ReglaError(`Solo se puede cancelar con al menos ${HORAS_LIMITE_CANCELACION} horas de anticipación. No hay reembolso.`, 409);
        }
    }

    const cancelada = await Reservaciones.findOneAndUpdate(
        { _id: actual._id, estatus: { $in: ESTATUS_ACTIVOS } },
        { estatus: 'cancelada', fechaCancelacion: new Date() },
        { new: true },
    );
    if (!cancelada) throw new ReglaError('La reservación cambió mientras se procesaba. Vuelve a consultarla.', 409);
    return cancelada;
}

// ---------- Reagendar ----------

export async function reagendarReservacion(
    id: string,
    body: any,
    opciones: { forzar?: boolean; idCliente?: string } = {},
) {
    const actual = await buscar(id, opciones.idCliente);
    if (actual.estatus === 'cancelada') throw new ReglaError('No se puede reagendar una reservación cancelada', 409);
    if (actual.estatus === 'no_asistio') throw new ReglaError('Si el cliente no asiste a su clase, no puede reagendar', 409);
    if (actual.asistenciaConfirmada) throw new ReglaError('No se puede reagendar: el cliente ya asistió a la clase', 409);

    if (!opciones.forzar) {
        if (actual.reagendada) throw new ReglaError('Esta reservación ya se reagendó una vez y no puede reagendarse de nuevo', 409);
        const instante = instanteClase(actual.fechaReservacion, actual.horaClase);
        if (instante && instante.getTime() <= Date.now()) {
            throw new ReglaError('La clase original ya pasó: ya no se puede reagendar', 409);
        }
    }

    const nuevo = validarHorario(body);
    if (nuevo.idHorario === actual.idHorario && nuevo.fechaReservacion === actual.fechaReservacion) {
        throw new ReglaError('Elige un horario distinto al actual');
    }
    await verificarSinDuplicado(actual.idCliente, nuevo.idHorario, String(actual._id));

    const reagendada = await Reservaciones.findOneAndUpdate(
        {
            _id: actual._id,
            estatus: { $in: ESTATUS_ACTIVOS },
            asistenciaConfirmada: { $ne: true },
            ...(opciones.forzar ? {} : { reagendada: { $ne: true } }), // evita reagendar dos veces a la vez
        },
        {
            ...nuevo,
            reagendada: true,
            fechaReagendacion: new Date(),
            reagendadaDesde: {
                idHorario: actual.idHorario,
                clase: actual.clase,
                entrenador: actual.entrenador,
                horaClase: actual.horaClase,
                fechaReservacion: actual.fechaReservacion,
            },
        },
        { new: true },
    );
    if (!reagendada) throw new ReglaError('La reservación cambió mientras se procesaba. Vuelve a consultarla.', 409);
    return reagendada;
}