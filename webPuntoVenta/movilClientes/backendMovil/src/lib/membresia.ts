// Membresías del cliente en la app. Las compras (webadministrativa_membresias_compras) son la fuente única,
// las mismas que usan cobro y la web administrativa: aquí solo se calculan las vistas para la app.
import type { Model } from 'mongoose';
import { CompraMembresia } from '../membresias-core/compra.model';
import {
    cargarCartera, coberturaEnMemoria, saldoEnMemoria, saldoTotalEnMemoria, type Cartera,
} from '../membresias-core/compras';
import { Reservacion } from '../models/reservacion';
import { Clase } from '../models/clase';
import type { ResumenMembresia } from './reglas';

export const Compras = CompraMembresia as unknown as Model<any>;
export const Reservaciones = Reservacion as unknown as Model<any>;

/** Compras pagadas del cliente y las reservaciones que las consumen (una sola consulta por petición). */
export const carteraDe = (idCliente: string): Promise<Cartera> => cargarCartera(Compras, Reservaciones, idCliente);

export interface InfoPaquete {
    /** ¿Una membresía comprada cubre esta clase ese día y todavía tiene accesos? */
    cubre: boolean;
    /** ¿Tiene alguna membresía vigente ese día (aunque no cubra esta clase)? */
    vigente: boolean;
    /** Accesos de esa clase que quedan (null = ilimitados o no aplica). */
    restantes: number | null;
    total: number | null;
}

export function infoParaClase(cartera: Cartera, idClase: string, fecha: string): InfoPaquete {
    const vigente = cartera.compras.some((c) => c.fechaInicio <= fecha && c.fechaFin >= fecha);
    const compra = coberturaEnMemoria(cartera, String(idClase), fecha);
    if (!compra) return { cubre: false, vigente, restantes: null, total: null };
    const saldo = saldoEnMemoria(compra, cartera.usos.get(String(compra._id)) ?? [], String(idClase));
    return { cubre: true, vigente: true, restantes: saldo.disponibles, total: saldo.total };
}

const idsValidos = (ids: string[]) => ids.filter((i) => /^[a-f\d]{24}$/i.test(i));

/** Nombres de las clases por id (para mostrar "Pilates / Yoga"). */
export async function nombresDeClases(ids: string[]): Promise<Map<string, string>> {
    const clases = await Clase.find({ _id: { $in: idsValidos(ids) } }).select('nombre');
    return new Map(clases.map((c) => [String(c._id), c.nombre]));
}

/**
 * Resumen que ve el cliente en el inicio (el aro de clases). Toma la membresía vigente que vence antes;
 * si no hay ninguna vigente, la más reciente. null si nunca compró una.
 */
export async function resumenMembresiaDe(idCliente: string, hoy: string): Promise<ResumenMembresia | null> {
    const cartera = await carteraDe(idCliente);
    if (!cartera.compras.length) return null;
    const vigentes = cartera.compras.filter((c) => c.fechaInicio <= hoy && c.fechaFin >= hoy);
    const compra = vigentes[0] ?? cartera.compras[cartera.compras.length - 1];
    const saldo = saldoTotalEnMemoria(compra, cartera.usos.get(String(compra._id)) ?? []);
    const nombres = await nombresDeClases(compra.condiciones.clasesIds);
    const clases = compra.condiciones.clasesIds.map((id: string) => nombres.get(id)).filter(Boolean).join(' / ');
    const total = saldo.total ?? 0;

    return {
        vigente: vigentes.length > 0,
        tipo: compra.condiciones.nombre ?? null,
        fechaFin: compra.fechaFin ?? null,
        paquete: total > 0
            ? {
                nombre: `${clases || compra.condiciones.nombre} · ${total} clases`,
                claseIncluida: clases || String(compra.condiciones.nombre),
                total,
                usadas: saldo.consumidas + saldo.apartadas,
                restantes: saldo.disponibles ?? 0,
                porcentajeRestante: Math.round(((saldo.disponibles ?? 0) / total) * 100),
            }
            : null,
    };
}
