// ============================================================================
// NÚCLEO COMPARTIDO DE MEMBRESÍAS  ·  compras.ts
// Carpeta idéntica en backend-administrativa y movilClientes/backendMovil (ver compra.model.ts).
//
// Reglas de una compra de membresía, iguales para cobro, administrativa y la app móvil:
//   - La vigencia es un intervalo inclusivo (una compra de un día vence el día de inicio).
//   - El saldo se calcula con las reservaciones que apuntan a la compra (membresiaCompraId).
//     Una reservación cancelada con lugar confirmado SIGUE consumiendo su acceso (sin reembolso,
//     sección 3.1.5); la que estaba en lista de espera no consumió nada. Cambia esa regla en
//     CANCELACION_CONSUME_ACCESO si el negocio decide devolver el acceso al cancelar.
//   - Entre varias compras vigentes se usa primero la que vence antes.
// Los modelos y la fecha de hoy se reciben como parámetro: cada backend declara los suyos.
// ============================================================================
import type { Model } from 'mongoose';
import { generarCodigo, PREFIJO_MEMBRESIA } from '../clientes-core/codigos';

/** true = cancelar una reservación cubierta por la membresía NO devuelve el acceso (sin reembolso). */
export const CANCELACION_CONSUME_ACCESO = true;

export class ReglaMembresia extends Error {
    status: number;
    esRegla = true;
    constructor(mensaje: string, status = 409) {
        super(mensaje);
        this.status = status;
    }
}

export const codigoMembresia = () => generarCodigo(PREFIJO_MEMBRESIA);

// ---------- Vigencia y condiciones ----------

/** Último día de vigencia de una compra que inicia en `inicio` ("AAAA-MM-DD"), según la opción elegida. */
export function finVigencia(inicio: string, opcion: any): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) throw new ReglaMembresia('Fecha de inicio inválida.', 400);
    const [y, m, d] = inicio.split('-').map(Number);
    const fecha = new Date(Date.UTC(y, m - 1, d));
    if (fecha.toISOString().slice(0, 10) !== inicio) throw new ReglaMembresia('Fecha de inicio inválida.', 400);
    const meses = opcion.unidadDuracion === 'meses';
    const duracion = Number(opcion.duracion ?? opcion.vigenciaDias);
    if (!Number.isSafeInteger(duracion) || duracion < 1 || duracion > 36500) {
        throw new ReglaMembresia('La opción no tiene una vigencia válida.');
    }
    if (meses) {
        fecha.setUTCDate(1);
        fecha.setUTCMonth(fecha.getUTCMonth() + duracion);
        const ultimo = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0)).getUTCDate();
        fecha.setUTCDate(Math.min(d, ultimo));
    } else {
        fecha.setUTCDate(fecha.getUTCDate() + duracion);
    }
    // Intervalo inclusivo: una compra de un día vence el día de inicio.
    fecha.setUTCDate(fecha.getUTCDate() - 1);
    return fecha.toISOString().slice(0, 10);
}

/**
 * Valida que la membresía del catálogo y su opción se puedan vender y devuelve la copia de sus condiciones
 * que se guarda en la compra. `membresia` es el documento del catálogo ya convertido con toJSON().
 */
export function condicionesDe(membresia: any, opcionId: string) {
    const opcion = membresia?.opciones?.find((o: any) => o.id === opcionId);
    if (membresia?.estatus !== 'activo' || !opcion) throw new ReglaMembresia('La membresía u opción ya no está disponible.');
    if (!Array.isArray(membresia.clasesIds) || !membresia.clasesIds.length) {
        throw new ReglaMembresia('Vincula esta membresía con clases del catálogo antes de venderla.');
    }
    const costo = Number(opcion.costo);
    if (opcion.costo === null || !Number.isFinite(costo) || costo < 0 || costo > 99999999.99) {
        throw new ReglaMembresia('Define un precio válido de hasta $99,999,999.99 antes de vender.');
    }
    if (opcion.entradas !== null && (!Number.isSafeInteger(opcion.entradas) || opcion.entradas < 1)) {
        throw new ReglaMembresia('Cantidad de entradas inválida.');
    }
    if (
        opcion.distribucion === 'por_clase' &&
        membresia.clasesIds.some((id: string) => !Number.isSafeInteger(opcion.entradasPorClase?.[id]) || opcion.entradasPorClase[id] < 1)
    ) {
        throw new ReglaMembresia('Faltan las entradas por clase.');
    }
    return {
        nombre: membresia.nombre,
        clasesIds: membresia.clasesIds.map(String),
        opcion: { ...opcion },
        complementos: membresia.complementos,
        kit: membresia.kit,
    };
}

// ---------- Saldo ----------

export interface Saldo {
    /** Entradas incluidas (null = ilimitadas). */
    total: number | null;
    /** Ya utilizadas: asistió, no asistió o canceló (sin reembolso). */
    consumidas: number;
    /** Apartadas: reservadas y todavía por venir. */
    apartadas: number;
    /** Entradas que quedan libres para reservar (null = ilimitadas). */
    disponibles: number | null;
}

export type Uso = { claseId?: string; estatus: string; asistenciaConfirmada?: boolean; estadoCupo?: string };

/** ¿Esta reservación (de las que apuntan a la compra) gasta una entrada? */
export const consumeEntrada = (r: Uso): boolean =>
    r.estatus !== 'cancelada' || (CANCELACION_CONSUME_ACCESO && r.estadoCupo !== 'espera');

const yaUsada = (u: Uso) => u.estatus === 'no_asistio' || u.estatus === 'cancelada' || Boolean(u.asistenciaConfirmada);
const idDe = (compra: any) => String(compra._id ?? compra.idCompra);

/** Entradas de una compra para una clase (null = ilimitadas). En 'por_clase' cada clase tiene las suyas. */
export function limiteParaClase(compra: any, claseId: string): number | null {
    const opcion = compra.condiciones.opcion;
    return opcion.distribucion === 'por_clase' ? (opcion.entradasPorClase?.[claseId] ?? 0) : opcion.entradas;
}

/** Saldo de una compra para una clase, a partir de las reservaciones que ya se cargaron. */
export function saldoEnMemoria(compra: any, usos: Uso[], claseId: string): Saldo {
    const porClase = compra.condiciones.opcion.distribucion === 'por_clase';
    const relevantes = (porClase ? usos.filter((u) => u.claseId === claseId) : usos).filter(consumeEntrada);
    const limite = limiteParaClase(compra, claseId);
    const consumidas = relevantes.filter(yaUsada).length;
    return {
        total: limite,
        consumidas,
        apartadas: relevantes.length - consumidas,
        disponibles: limite === null ? null : Math.max(0, limite - relevantes.length),
    };
}

/** Saldo de la compra completa (suma de todas las clases) para mostrar en la app. */
export function saldoTotalEnMemoria(compra: any, usos: Uso[]): Saldo {
    const opcion = compra.condiciones.opcion;
    const vigentes = usos.filter(consumeEntrada);
    const total: number | null = opcion.distribucion === 'por_clase'
        ? Object.values<number>(opcion.entradasPorClase ?? {}).reduce((suma, n) => suma + Number(n), 0)
        : opcion.entradas;
    const consumidas = vigentes.filter(yaUsada).length;
    return {
        total,
        consumidas,
        apartadas: vigentes.length - consumidas,
        disponibles: total === null ? null : Math.max(0, total - vigentes.length),
    };
}

// ---------- Cartera del cliente ----------

/** Compras pagadas de un cliente y las reservaciones que las consumen, cargadas una sola vez. */
export interface Cartera {
    compras: any[];
    usos: Map<string, Uso[]>;
}

export async function cargarCartera(Compra: Model<any>, Reservacion: Model<any>, idCliente: string): Promise<Cartera> {
    const compras = await Compra.find({ idCliente, estado: 'activa' }).sort({ fechaFin: 1, _id: 1 }).lean();
    const usos = new Map<string, Uso[]>();
    if (compras.length) {
        const ids = compras.map((c: any) => String(c._id));
        const reservaciones = await Reservacion.find({ membresiaCompraId: { $in: ids } })
            .select('membresiaCompraId claseId estatus asistenciaConfirmada estadoCupo').lean();
        for (const r of reservaciones as any[]) {
            const lista = usos.get(r.membresiaCompraId) ?? [];
            lista.push(r);
            usos.set(r.membresiaCompraId, lista);
        }
    }
    return { compras, usos };
}

/** Compra vigente que cubre `claseId` el día `fecha` y todavía tiene entradas (la que vence antes va primero). */
export function coberturaEnMemoria(cartera: Cartera, claseId: string, fecha: string): any | null {
    for (const compra of cartera.compras) {
        if (fecha < compra.fechaInicio || fecha > compra.fechaFin) continue;
        if (!compra.condiciones.clasesIds.includes(claseId)) continue;
        const saldo = saldoEnMemoria(compra, cartera.usos.get(idDe(compra)) ?? [], claseId);
        if (saldo.disponibles === null || saldo.disponibles > 0) return compra;
    }
    return null;
}

// ---------- Cobertura (con la base de datos) ----------

/** Saldo de una compra para una clase (consulta las reservaciones). */
export async function saldoDe(Reservacion: Model<any>, compra: any, claseId: string): Promise<Saldo> {
    const usos = await Reservacion.find({ membresiaCompraId: idDe(compra) }).select('claseId estatus asistenciaConfirmada estadoCupo').lean();
    return saldoEnMemoria(compra, usos as Uso[], claseId);
}

export async function saldoTotal(Reservacion: Model<any>, compra: any): Promise<Saldo> {
    const usos = await Reservacion.find({ membresiaCompraId: idDe(compra) }).select('claseId estatus asistenciaConfirmada estadoCupo').lean();
    return saldoTotalEnMemoria(compra, usos as Uso[]);
}

/**
 * Compra vigente del cliente que cubre `claseId` el día `fecha` y todavía tiene entradas, o null.
 * La que vence antes se usa primero.
 */
export async function buscarCobertura(
    Compra: Model<any>,
    Reservacion: Model<any>,
    idCliente: string,
    claseId: string,
    fecha: string,
): Promise<any | null> {
    return coberturaEnMemoria(await cargarCartera(Compra, Reservacion, idCliente), claseId, fecha);
}

/**
 * Se vuelve a contar después de crear una reservación cubierta: dos reservaciones simultáneas podrían haber
 * visto la misma última entrada. Devuelve true si la compra quedó dentro de su límite.
 */
export async function dentroDelLimite(Reservacion: Model<any>, compra: any, claseId: string): Promise<boolean> {
    const usos = await Reservacion.find({ membresiaCompraId: idDe(compra) }).select('claseId estatus asistenciaConfirmada estadoCupo').lean();
    const limite = limiteParaClase(compra, claseId);
    if (limite === null) return true;
    const porClase = compra.condiciones.opcion.distribucion === 'por_clase';
    const relevantes = ((porClase ? (usos as Uso[]).filter((u) => u.claseId === claseId) : usos) as Uso[]).filter(consumeEntrada);
    return relevantes.length <= limite;
}

/**
 * Inserta una compra con su código PQ-XXXXX (si el código ya existe, genera otro). Si la misma solicitudId ya
 * creó una compra (reintento o doble envío), devuelve esa en lugar de duplicarla.
 */
export async function insertarCompra(
    Compra: Model<any>,
    datos: Record<string, any>,
): Promise<{ compra: any; repetida: boolean }> {
    for (let intento = 0; intento < 8; intento++) {
        try {
            return { compra: await Compra.create({ ...datos, codigo: codigoMembresia() }), repetida: false };
        } catch (err: any) {
            if (err?.code === 11000 && err?.keyPattern?.codigo) continue;
            if (err?.code === 11000 && err?.keyPattern?.solicitudId && datos.solicitudId) {
                return { compra: await Compra.findOne({ solicitudId: datos.solicitudId }), repetida: true };
            }
            throw err;
        }
    }
    throw new Error('No se pudo generar un código de membresía único');
}

/** Al reagendar una reservación cubierta, el nuevo horario debe caer en la vigencia y en las clases de la compra. */
export function validarCoberturaReagenda(compra: any, fechaNueva: string, claseId: string): void {
    if (
        !compra ||
        compra.estado !== 'activa' ||
        fechaNueva < compra.fechaInicio ||
        fechaNueva > compra.fechaFin ||
        !compra.condiciones.clasesIds.includes(claseId)
    ) {
        throw new ReglaMembresia('El nuevo horario no está cubierto por la vigencia y clases de la membresía comprada.');
    }
}
