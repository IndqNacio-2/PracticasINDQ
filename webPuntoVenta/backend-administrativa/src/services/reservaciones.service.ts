import type { NextFunction, Request, Response } from 'express';
import { isValidObjectId, type Model } from 'mongoose';
import { Reservacion } from '../models/Reservaciones/reservacion';
import { Horario } from '../models/Horarios/horarios';
import { Clase } from '../models/Clases/clases';
import { ClienteModel } from '../models/Clientes/clienteTipado';
import { parseFechaISO, ZONA_HORARIA } from '../lib/edad';
import { generarCodigo, PREFIJO_RESERVACION } from '../clientes-core/codigos';
import { ESTATUS_INACTIVOS, liberarLugar, tomarLugar, type EstadoCupo } from '../reservaciones-core/cupo';
import { CompraMembresia } from '../membresias-core/compra.model';
import { buscarCobertura, dentroDelLimite, ReglaMembresia, validarCoberturaReagenda } from '../membresias-core/compras';

// Reglas de negocio de las reservaciones (sección 3.1.5). Esta es la ÚNICA implementación:
// cobro y la app móvil usan estas mismas reglas (cobro por la API /admin/api/reservaciones).
//  - Cada reservación recibe un código/folio único: NU-XXXXX.
//  - Reagendar: solo una vez y sin costo. Quien no asistió no puede reagendar.
//  - Cancelar: hasta 24 horas antes de la clase y sin reembolso.
//  - Inasistencia: sin reembolso y sin reagendar.
//  - Cupo: se descuenta al reservar; con la sesión llena y lista de espera habilitada se queda en 'espera'.
//  - Cada persona puede tener como máximo 3 reservaciones activas por venir.
//  - Reagendar solo a otro horario de la misma clase y con lugar disponible (no entra a lista de espera).
//  - Si el cliente tiene una membresía comprada vigente que cubre la clase y con entradas, la reservación
//    la usa (precio 0, ya pagada). Cada reservación cubierta consume una entrada; ver membresias-core.
// El personal puede saltarse las reglas de tiempo/cantidad con `forzar: true`; el cliente (app móvil) no.

/** Horas mínimas de anticipación para cancelar. Cámbialo aquí si la regla es otra. */
export const HORAS_LIMITE_CANCELACION = 24;
/** Minutos de tolerancia tras el inicio de una clase sin hora de fin conocida antes de marcar inasistencia. */
const TOLERANCIA_INASISTENCIA_MIN = 15;

/** Reservaciones activas por venir que puede tener una misma persona. */
export const LIMITE_RESERVAS_ACTIVAS = 3;

const ESTATUS = ['pendiente', 'confirmada', 'cancelada', 'no_asistio'];
const ESTATUS_ACTIVOS = ['pendiente', 'confirmada'];

// Se tipa suelto a propósito: los filtros con $in/$ne sobre un enum chocan con los tipos inferidos.
const Reservaciones = Reservacion as unknown as Model<any>;
const Horarios = Horario as unknown as Model<any>;
const Compras = CompraMembresia as unknown as Model<any>;

export class ReglaError extends Error {
    status: number;
    constructor(mensaje: string, status = 400) {
        super(mensaje);
        this.status = status;
    }
}

/** Manejador de errores de reglas de negocio. Va antes de `manejarErrores` en cada router. */
export function manejarReglas(err: any, _req: Request, res: Response, next: NextFunction) {
    if (err instanceof ReglaError || err?.esRegla) return res.status(err.status).json({ error: err.message });
    next(err);
}

export interface DatosHorario {
    idHorario: string;
    clase: string;
    claseId: string;
    entrenador: string;
    horaClase: string;
    fechaClase: string;
}

// ---------- Utilidades ----------

// Código de reservación: NU-XXXXX (prefijo + guion + 5 dígitos), igual en todos los módulos.
const codigoReservacion = () => generarCodigo(PREFIJO_RESERVACION);

/** Fecha de hoy "AAAA-MM-DD" en la zona horaria del negocio. */
const hoyLocal = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

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

/** "06:00 - 06:50" → inicio "06:00" y fin "06:50" (el fin es null si solo hay una hora). */
function horasDe(horaClase: string): { inicio: string; fin: string | null } {
    const horas = String(horaClase ?? '').match(/\d{1,2}:\d{2}/g) ?? [];
    return { inicio: horas[0] ?? String(horaClase ?? ''), fin: horas[1] ?? null };
}

const inicioDeClase = (r: { fechaClase: string; horaClase: string }) => instanteClase(r.fechaClase, horasDe(r.horaClase).inicio);

function texto(valor: unknown, campo: string): string {
    if (typeof valor !== 'string' || !valor.trim() || valor.length > 150) {
        throw new ReglaError(`${campo} es obligatorio`);
    }
    return valor.trim();
}

/**
 * Toma del horario (la fuente de verdad) la clase, el entrenador, la hora y la fecha de la sesión.
 * Lo que mande el navegador sobre esos datos se ignora: solo importa el id del horario.
 */
async function resolverHorario(idHorario: unknown): Promise<{ horario: any; clase: any; datos: DatosHorario }> {
    if (!isValidObjectId(idHorario)) throw new ReglaError('El horario es obligatorio');
    const horario: any = await Horarios.findById(idHorario);
    if (!horario || horario.estatus !== 'activo') throw new ReglaError('El horario no existe o no está activo', 404);
    const instante = instanteClase(horario.fecha, horario.horaInicio);
    if (!instante) throw new ReglaError('La hora de la clase no es válida (usa HH:mm)');
    if (instante.getTime() <= Date.now()) throw new ReglaError('La clase ya pasó o ya inició');
    const clase: any = await Clase.findById(horario.idClase);
    return {
        horario,
        clase,
        datos: {
            idHorario: String(horario._id),
            clase: horario.nombreClase,
            claseId: String(horario.idClase),
            entrenador: horario.nombreEntrenador ?? '',
            horaClase: `${horario.horaInicio} - ${horario.horaFin}`,
            fechaClase: horario.fecha,
        },
    };
}

async function buscar(id: string, idCliente?: string): Promise<any> {
    if (!isValidObjectId(id)) throw new ReglaError('ID de reservación inválido');
    const reservacion = await Reservaciones.findOne({ _id: id, ...(idCliente ? { idCliente } : {}) });
    if (!reservacion) throw new ReglaError('Reservación no encontrada', 404);
    return reservacion;
}

/** Máximo de reservaciones activas por venir por persona (clase que aún no empieza). */
async function verificarLimiteActivas(persona: { tipo: 'cliente' | 'visitante'; idCliente: string | null; nombre: string }) {
    const vigentes = await Reservaciones.find({
        ...(persona.tipo === 'cliente' ? { idCliente: persona.idCliente } : { tipo: 'visitante', nombreCliente: persona.nombre }),
        estatus: { $in: ESTATUS_ACTIVOS },
        fechaClase: { $gte: hoyLocal() },
    }).select('fechaClase horaClase');
    const porVenir = vigentes.filter((r: any) => {
        const instante = inicioDeClase(r);
        return instante ? instante.getTime() > Date.now() : false;
    }).length;
    if (porVenir >= LIMITE_RESERVAS_ACTIVAS) {
        throw new ReglaError(
            `"${persona.nombre}" ya tiene ${LIMITE_RESERVAS_ACTIVAS} reservaciones activas. Cancela una para crear otra.`,
            409,
        );
    }
}

async function verificarSinDuplicado(
    persona: { tipo: 'cliente' | 'visitante'; idCliente: string | null; nombre: string },
    idHorario: string,
    excluirId?: string,
) {
    const existe = await Reservaciones.exists({
        ...(persona.tipo === 'cliente'
            ? { idCliente: persona.idCliente }
            : { tipo: 'visitante', nombreCliente: persona.nombre }),
        idHorario,
        estatus: { $in: ESTATUS_ACTIVOS },
        ...(excluirId ? { _id: { $ne: excluirId } } : {}),
    });
    if (existe) {
        throw new ReglaError(
            persona.tipo === 'cliente'
                ? 'El cliente ya tiene una reservación activa en ese horario'
                : `"${persona.nombre}" ya tiene una reservación activa en ese horario`,
            409,
        );
    }
}

/** Convierte a la forma de salida e incluye, si la hubo, la reservación que subió de la lista de espera. */
const conPromovida = (reservacion: any, promovida: any) =>
    Object.assign(reservacion.toJSON(), { promovida: promovida ? promovida.toJSON() : null });

// ---------- Inasistencias ----------

/**
 * Toda reservación vigente, con lugar confirmado y sin asistencia, cuya clase ya terminó
 * (o empezó hace más de la tolerancia, si no se conoce la hora de fin) queda como 'no_asistio':
 * el cliente nunca llegó, así que no hay reembolso ni reagenda. Se ejecuta al consultar.
 */
export async function marcarInasistenciasVencidas(ahora = new Date()): Promise<number> {
    const condicion = {
        estatus: { $in: ESTATUS_ACTIVOS },
        asistenciaConfirmada: { $ne: true },
        estadoCupo: { $ne: 'espera' },
    };
    const candidatas = await Reservaciones.find({ ...condicion, fechaClase: { $lte: hoyLocal() } }).select('fechaClase horaClase');
    const vencidas = candidatas.filter((r: any) => {
        const { inicio, fin } = horasDe(r.horaClase);
        const instante = instanteClase(r.fechaClase, fin ?? inicio);
        if (!instante) return false;
        const limite = fin ? instante.getTime() : instante.getTime() + TOLERANCIA_INASISTENCIA_MIN * 60_000;
        return limite <= ahora.getTime();
    });
    if (!vencidas.length) return 0;
    const resultado = await Reservaciones.updateMany(
        { ...condicion, _id: { $in: vencidas.map((r: any) => r._id) } },
        { estatus: 'no_asistio' },
    );
    return resultado.modifiedCount;
}

// ---------- Consulta ----------

export async function listarReservaciones(query: Record<string, unknown> = {}) {
    await marcarInasistenciasVencidas();
    const filtro: Record<string, any> = {};
    const cadena = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    if (cadena(query.idCliente)) filtro.idCliente = cadena(query.idCliente);
    if (cadena(query.idHorario)) filtro.idHorario = cadena(query.idHorario);
    if (cadena(query.fecha)) filtro.fechaClase = cadena(query.fecha);
    if (cadena(query.codigo)) filtro.codigo = cadena(query.codigo)!.toUpperCase();
    if (cadena(query.membresiaCompraId)) filtro.membresiaCompraId = cadena(query.membresiaCompraId);
    if (cadena(query.nombreCliente)) filtro.nombreCliente = cadena(query.nombreCliente);
    const estatus = cadena(query.estatus);
    if (estatus && ESTATUS.includes(estatus)) filtro.estatus = estatus;
    const estadoPago = cadena(query.estadoPago);
    if (estadoPago === 'pendiente' || estadoPago === 'pagado') filtro.estadoPago = estadoPago;
    const tipo = cadena(query.tipo);
    if (tipo === 'cliente' || tipo === 'visitante') filtro.tipo = tipo;
    return Reservaciones.find(filtro).sort({ fechaClase: -1, horaClase: -1 }).limit(1000);
}

export const buscarPorId = (id: string, idCliente?: string) => buscar(id, idCliente);

export async function buscarPorCodigo(codigo: string, idCliente?: string) {
    await marcarInasistenciasVencidas();
    const reservacion = await Reservaciones.findOne({
        codigo: String(codigo).trim().toUpperCase(),
        ...(idCliente ? { idCliente } : {}),
    });
    if (!reservacion) throw new ReglaError('Reservación no encontrada', 404);
    return reservacion;
}

// ---------- Alta ----------

/**
 * Crea una reservación de un cliente registrado o de un visitante (body.tipo = 'visitante' + nombreCliente).
 * Body: idHorario (obligatorio; clase, hora y fecha salen del horario), tipo, idCliente / nombreCliente,
 *       origen ('recepcion' | 'app'). Si una membresía comprada y vigente cubre la clase, se usa sola: precio 0.
 * El precio sale de la tarifa de la clase en el servidor; nunca de lo que mande el navegador.
 */
export async function crearReservacion(body: any, idCliente?: string, estatusInicial?: unknown) {
    const tipo: 'cliente' | 'visitante' = body?.tipo === 'visitante' ? 'visitante' : 'cliente';

    let idRef: string | null = null;
    let nombreCliente: string;
    if (tipo === 'cliente') {
        const id = idCliente ?? String(body?.idCliente ?? '');
        if (!isValidObjectId(id)) throw new ReglaError('ID de cliente inválido');
        const cliente: any = await ClienteModel.findById(id);
        if (!cliente) throw new ReglaError('Cliente no encontrado', 404);
        if (cliente.estatus !== 'activo') throw new ReglaError('El cliente está dado de baja', 403);
        idRef = String(cliente._id);
        nombreCliente = `${cliente.nombre} ${cliente.apellidos}`.trim();
    } else {
        nombreCliente = texto(body?.nombreCliente, 'El nombre del visitante');
    }

    const { horario, clase, datos } = await resolverHorario(body?.idHorario);
    await verificarSinDuplicado({ tipo, idCliente: idRef, nombre: nombreCliente }, datos.idHorario);
    await verificarLimiteActivas({ tipo, idCliente: idRef, nombre: nombreCliente });

    // ¿Una membresía comprada y vigente cubre esta clase? Solo aplica a clientes registrados.
    const compraCubre = tipo === 'cliente' && idRef
        ? await buscarCobertura(Compras, Reservaciones, idRef, datos.claseId, datos.fechaClase)
        : null;
    const cubierta = Boolean(compraCubre);
    const membresiaCompraId = compraCubre ? String(compraCubre._id) : '';
    const tarifa = Number(clase?.precio);
    if (!cubierta && !(Number.isFinite(tarifa) && tarifa > 0)) {
        throw new ReglaError('La clase no tiene una tarifa válida; defínela en el catálogo de clases');
    }

    // Cupo: se aparta un lugar de forma atómica; si no hay, lista de espera (solo si la sesión la habilita).
    let estadoCupo: EstadoCupo = 'confirmada';
    if (!(await tomarLugar(Horarios, datos.idHorario))) {
        if (!horario.listaEsperaHabilitada) throw new ReglaError('La sesión está llena', 409);
        estadoCupo = 'espera';
    }

    try {
        for (let intento = 0; intento < 8; intento++) {
            try {
                const creada = await Reservaciones.create({
                    ...datos,
                    codigo: codigoReservacion(),
                    tipo,
                    idCliente: idRef,
                    nombreCliente,
                    fechaReservacion: hoyLocal(),
                    estatus: estatusInicial === 'confirmada' ? 'confirmada' : 'pendiente',
                    asistenciaConfirmada: false,
                    estadoCupo,
                    origen: body?.origen === 'app' ? 'app' : 'recepcion',
                    precio: cubierta ? 0 : tarifa,
                    estadoPago: cubierta ? 'pagado' : 'pendiente',
                    fechaPago: cubierta ? new Date() : null,
                    metodoPago: cubierta ? 'membresia' : '',
                    pagoTipo: cubierta ? 'paquete' : 'recepcion',
                    membresiaCompraId,
                });
                // Dos reservaciones simultáneas pudieron ver la misma última entrada: se vuelve a contar.
                if (compraCubre && !(await dentroDelLimite(Reservaciones, compraCubre, datos.claseId))) {
                    await Reservaciones.deleteOne({ _id: creada._id });
                    throw new ReglaMembresia('La membresía ya no tiene entradas disponibles para esta clase.');
                }
                return creada;
            } catch (err: any) {
                if (err?.code === 11000 && err?.keyPattern?.codigo) continue; // código repetido: se genera otro
                throw err;
            }
        }
        throw new Error('No se pudo generar un código de reservación único');
    } catch (err) {
        // No quedó reservación: el lugar apartado se devuelve.
        if (estadoCupo === 'confirmada') await liberarLugar(Horarios, Reservaciones, datos.idHorario);
        throw err;
    }
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

/**
 * Confirma la asistencia. Debe estar pagada (o cubierta por una membresía), con lugar confirmado
 * y solo se confirma el día de la sesión. El personal puede saltarse esas reglas con `forzar`.
 */
export async function marcarAsistencia(id: string, opciones: { forzar?: boolean } = {}) {
    await marcarInasistenciasVencidas();
    const actual = await buscar(id);
    if (actual.estatus === 'cancelada') throw new ReglaError('No se puede confirmar asistencia de una reservación cancelada', 409);
    if (actual.estatus === 'no_asistio') throw new ReglaError('La clase ya pasó y quedó registrada como inasistencia', 409);
    if (actual.asistenciaConfirmada) throw new ReglaError('Este cliente ya tiene asistencia confirmada', 409);
    if (actual.estadoCupo === 'espera') throw new ReglaError('No se puede confirmar asistencia mientras el cliente siga en lista de espera', 409);
    if (!opciones.forzar) {
        if (actual.estadoPago !== 'pagado') {
            throw new ReglaError('Primero registra el pago o la cobertura de esta reserva', 409);
        }
        if (actual.fechaClase !== hoyLocal()) {
            throw new ReglaError('La asistencia solo se confirma el día de la sesión', 409);
        }
    }
    const confirmada = await Reservaciones.findOneAndUpdate(
        { _id: actual._id, estatus: { $in: ESTATUS_ACTIVOS }, asistenciaConfirmada: { $ne: true } },
        { estatus: 'confirmada', asistenciaConfirmada: true },
        { new: true },
    );
    if (!confirmada) throw new ReglaError('La reservación cambió mientras se procesaba. Vuelve a consultarla.', 409);
    return confirmada;
}

export async function marcarInasistencia(id: string) {
    const actual = await buscar(id);
    if (!ESTATUS_ACTIVOS.includes(actual.estatus) || actual.asistenciaConfirmada) {
        throw new ReglaError('Solo se puede marcar inasistencia en una reservación vigente sin asistencia', 409);
    }
    const instante = inicioDeClase(actual);
    if (instante && instante.getTime() > Date.now()) {
        throw new ReglaError('La clase aún no ha iniciado', 409);
    }
    actual.estatus = 'no_asistio';
    await actual.save();
    return actual;
}

/**
 * Registra que la reservación ya se pagó. El pago en sí (folio, método, efectivo, ticket) lo guarda el
 * módulo de cobro; aquí solo queda el estado para que lo vean todos los módulos.
 */
export async function registrarPago(id: string, datos: { metodoPago?: unknown; folioPago?: unknown }) {
    const actual = await buscar(id);
    if (!ESTATUS_ACTIVOS.includes(actual.estatus)) {
        throw new ReglaError(`No se puede cobrar una reservación ${actual.estatus === 'cancelada' ? 'cancelada' : 'con inasistencia'}`, 409);
    }
    if (actual.estadoCupo === 'espera') throw new ReglaError('No se puede cobrar mientras el cliente siga en lista de espera', 409);
    if (actual.estadoPago === 'pagado') throw new ReglaError('Esta reservación ya está pagada', 409);
    const pagada = await Reservaciones.findOneAndUpdate(
        { _id: actual._id, estadoPago: { $ne: 'pagado' }, estatus: { $in: ESTATUS_ACTIVOS } },
        {
            estadoPago: 'pagado',
            fechaPago: new Date(),
            metodoPago: typeof datos.metodoPago === 'string' ? datos.metodoPago.trim().slice(0, 40) : '',
            folioPago: typeof datos.folioPago === 'string' ? datos.folioPago.trim().slice(0, 60) : '',
        },
        { new: true },
    );
    if (!pagada) throw new ReglaError('La reservación cambió mientras se procesaba. Vuelve a consultarla.', 409);
    return pagada;
}

// ---------- Baja (cancelación) ----------

export async function cancelarReservacion(id: string, opciones: { forzar?: boolean; idCliente?: string } = {}) {
    const actual = await buscar(id, opciones.idCliente);
    if (actual.estatus === 'cancelada') throw new ReglaError('La reservación ya está cancelada', 409);
    if (actual.estatus === 'no_asistio') throw new ReglaError('No se puede cancelar: el cliente no asistió a su clase. No hay reembolso.', 409);
    if (actual.asistenciaConfirmada) throw new ReglaError('No se puede cancelar: el cliente ya asistió a la clase', 409);

    const instante = inicioDeClase(actual);
    if (!opciones.forzar) {
        if (!instante) throw new ReglaError('No se pudo determinar la hora de la clase. Contacta al gimnasio.');
        const horas = (instante.getTime() - Date.now()) / 3_600_000;
        if (horas < HORAS_LIMITE_CANCELACION) {
            throw new ReglaError(`Solo se puede cancelar con al menos ${HORAS_LIMITE_CANCELACION} horas de anticipación. No hay reembolso.`, 409);
        }
    } else if (instante && instante.getTime() <= Date.now()) {
        throw new ReglaError('La clase ya comenzó, ya no se puede cancelar', 409);
    }

    const cancelada = await Reservaciones.findOneAndUpdate(
        { _id: actual._id, estatus: { $in: ESTATUS_ACTIVOS } },
        { estatus: 'cancelada', fechaCancelacion: new Date() },
        { new: true },
    );
    if (!cancelada) throw new ReglaError('La reservación cambió mientras se procesaba. Vuelve a consultarla.', 409);

    // Solo un lugar confirmado libera cupo; quien estaba en lista de espera no apartaba ninguno.
    const promovida = cancelada.estadoCupo !== 'espera'
        ? await liberarLugar(Horarios, Reservaciones, cancelada.idHorario)
        : null;
    return conPromovida(cancelada, promovida);
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

    const instanteOriginal = inicioDeClase(actual);
    if (!opciones.forzar && actual.reagendada) {
        throw new ReglaError('Esta reservación ya se reagendó una vez y no puede reagendarse de nuevo', 409);
    }
    if (instanteOriginal && instanteOriginal.getTime() <= Date.now()) {
        throw new ReglaError('La clase original ya pasó: ya no se puede reagendar', 409);
    }

    const { datos: nuevo } = await resolverHorario(body?.idHorario);
    if (nuevo.idHorario === actual.idHorario) throw new ReglaError('Elige un horario distinto al actual');
    if (!opciones.forzar && nuevo.clase !== actual.clase) {
        throw new ReglaError(`Solo se puede reagendar a otro horario de la misma clase ("${actual.clase}")`, 409);
    }
    await verificarSinDuplicado(
        { tipo: actual.tipo === 'visitante' ? 'visitante' : 'cliente', idCliente: actual.idCliente, nombre: actual.nombreCliente },
        nuevo.idHorario,
        String(actual._id),
    );

    // Si la reservación está cubierta por una membresía, el nuevo horario debe caer en su vigencia y clases.
    if (actual.membresiaCompraId) {
        const compra = isValidObjectId(actual.membresiaCompraId) ? await Compras.findById(actual.membresiaCompraId) : null;
        validarCoberturaReagenda(compra, nuevo.fechaClase, nuevo.claseId);
    }

    // Lugar en el nuevo horario (el de origen se libera después de moverla). Reagendar no entra a lista de espera.
    if (!(await tomarLugar(Horarios, nuevo.idHorario))) throw new ReglaError('La sesión elegida ya no tiene cupo', 409);
    const estadoCupo: EstadoCupo = 'confirmada';

    const reagendada = await Reservaciones.findOneAndUpdate(
        {
            _id: actual._id,
            estatus: { $in: ESTATUS_ACTIVOS },
            asistenciaConfirmada: { $ne: true },
            idHorario: actual.idHorario,
            ...(opciones.forzar ? {} : { reagendada: { $ne: true } }), // evita reagendar dos veces a la vez
        },
        {
            ...nuevo,
            estadoCupo,
            reagendada: true,
            fechaReagendacion: new Date(),
            reagendadaDesde: {
                idHorario: actual.idHorario,
                clase: actual.clase,
                entrenador: actual.entrenador,
                horaClase: actual.horaClase,
                fechaClase: actual.fechaClase,
            },
        },
        { new: true },
    );
    if (!reagendada) {
        await liberarLugar(Horarios, Reservaciones, nuevo.idHorario);
        throw new ReglaError('La reservación cambió mientras se procesaba. Vuelve a consultarla.', 409);
    }

    const promovida = actual.estadoCupo !== 'espera'
        ? await liberarLugar(Horarios, Reservaciones, actual.idHorario)
        : null;
    return conPromovida(reagendada, promovida);
}

export { ESTATUS_INACTIVOS };
