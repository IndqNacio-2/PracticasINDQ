// ============================================================================
// NÚCLEO COMPARTIDO DE RESERVACIONES  ·  cupo.ts
// Carpeta idéntica en backend-administrativa y movilClientes/backendMovil
// (si cambias algo aquí, cópialo a la otra; el comando `diff -r` debe salir vacío).
//
// Una sola regla de cupo para todos los módulos (cobro, administrativa y app móvil):
//   - capacidadDisponible del horario se descuenta/devuelve de forma ATÓMICA.
//   - si la sesión está llena y tiene lista de espera, la reservación queda en 'espera'
//     (no aparta lugar);
//   - al liberarse un lugar, sube la primera persona de la lista de espera.
// Los modelos se reciben como parámetro porque cada backend declara los suyos.
// ============================================================================
import type { Model } from 'mongoose';

export const ESTADOS_CUPO = ['confirmada', 'espera'] as const;
export type EstadoCupo = (typeof ESTADOS_CUPO)[number];

// Estatus que ya no ocupan lugar ni cuentan como reservación vigente.
export const ESTATUS_INACTIVOS = ['cancelada', 'no_asistio'];

/** Descuenta un lugar del horario. true = se apartó; false = la sesión está llena o inactiva. */
export async function tomarLugar(Horario: Model<any>, idHorario: string): Promise<boolean> {
    const horario = await Horario.findOneAndUpdate(
        { _id: idHorario, estatus: 'activo', capacidadDisponible: { $gt: 0 } },
        { $inc: { capacidadDisponible: -1 } },
        { new: true },
    );
    return Boolean(horario);
}

/**
 * Libera el lugar de una reservación confirmada que se cancela o se reagenda.
 * Si hay alguien en lista de espera, esa persona ocupa el lugar (se devuelve su reservación);
 * si no, el lugar vuelve al horario sin pasar de la capacidad total.
 */
export async function liberarLugar(
    Horario: Model<any>,
    Reservacion: Model<any>,
    idHorario: string,
): Promise<any | null> {
    const promovida = await Reservacion.findOneAndUpdate(
        { idHorario: String(idHorario), estadoCupo: 'espera', estatus: { $nin: ESTATUS_INACTIVOS } },
        { estadoCupo: 'confirmada' },
        { sort: { fechaCreacion: 1, _id: 1 }, new: true },
    );
    if (promovida) return promovida;

    await Horario.updateOne(
        { _id: idHorario, $expr: { $lt: ['$capacidadDisponible', '$capacidadTotal'] } },
        { $inc: { capacidadDisponible: 1 } },
    );
    return null;
}
