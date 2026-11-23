// Reglas de negocio de la app de clientes, como funciones puras (fáciles de probar).
import { instante, minutosEntre } from './fecha';

/** Textos de las políticas que muestra la app antes de reservar */
export const POLITICAS = [
    'Puedes reagendar una sola vez, sin costo.',
    'Puedes cancelar hasta 24 h antes; no hay reembolso.',
    'Debes confirmar tu asistencia al menos 10 minutos antes para no perder tu lugar.',
    'Si no asistes, la reservación se pierde y se aplicará una penalización.',
];

export const HORAS_MINIMAS_PARA_CANCELAR = 24;

/** Resumen de la membresía comprada que ve el cliente en el inicio (se arma en lib/membresia.ts). */
export interface ResumenMembresia {
    vigente: boolean;
    tipo: string | null;
    fechaFin: string | null;
    /** Paquete de clases ("Pilates · 12 clases"); null si la membresía no incluye paquete */
    paquete: null | {
        nombre: string;
        claseIncluida: string;
        total: number;
        usadas: number;
        restantes: number;
        /** Porcentaje de clases que quedan (lo que dibuja el aro del inicio) */
        porcentajeRestante: number;
    };
}

/** Cuánto paga una clase fuera del paquete */
export function precioClase(precioDeLaClase: number | null | undefined, precioPorDefecto: number): number {
    return typeof precioDeLaClase === 'number' && precioDeLaClase >= 0 ? precioDeLaClase : precioPorDefecto;
}

export type NivelCupo = 'agotado' | 'critico' | 'bajo' | 'normal';

/** Cómo se resalta el cupo en la lista: ≤2 crítico (rojo), ≤5 bajo (naranja) */
export function nivelCupo(disponibles: number): NivelCupo {
    if (disponibles <= 0) return 'agotado';
    if (disponibles <= 2) return 'critico';
    if (disponibles <= 5) return 'bajo';
    return 'normal';
}

/** Iniciales para el avatar: "Andrea Solís" → "AS" */
export function iniciales(nombreCompleto: string): string {
    return nombreCompleto
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join('');
}

export const duracionMin = (horaInicio: string, horaFin: string) => minutosEntre(horaInicio, horaFin);

/** La clase ya empezó (o terminó): ya no se puede reservar */
export function claseIniciada(fecha: string, horaInicio: string, ahora: Date): boolean {
    return instante(fecha, horaInicio) <= ahora;
}

/** "06:00 - 06:50" → { inicio: "06:00", fin: "06:50" } */
export function separarHoras(horaClase: string): { inicio: string; fin: string } {
    const m = /^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/.exec(horaClase.trim());
    if (m) return { inicio: m[1], fin: m[2] };
    const solo = /^\d{2}:\d{2}/.exec(horaClase.trim())?.[0] ?? '00:00';
    return { inicio: solo, fin: solo };
}

export interface ReservaBasica {
    estatus: string;
    fechaClase: string;
    horaClase: string;
    asistenciaConfirmada?: boolean | null;
}

export type EstadoReserva = 'proxima' | 'asistio' | 'no_asistio' | 'cancelada';

/**
 * Estado que ve el cliente:
 *  - cancelada: la canceló él
 *  - proxima: la clase aún no termina
 *  - asistio / no_asistio: la clase ya pasó (según si recepción confirmó su asistencia)
 */
export function estadoReserva(r: ReservaBasica, ahora: Date): EstadoReserva {
    if (r.estatus === 'cancelada') return 'cancelada';
    const { fin } = separarHoras(r.horaClase);
    if (ahora < instante(r.fechaClase, fin)) return 'proxima';
    return r.asistenciaConfirmada ? 'asistio' : 'no_asistio';
}

/** Cancelar solo se permite con 24 h o más de anticipación */
export function puedeCancelar(r: ReservaBasica, ahora: Date): boolean {
    if (estadoReserva(r, ahora) !== 'proxima') return false;
    const { inicio } = separarHoras(r.horaClase);
    return instante(r.fechaClase, inicio).getTime() - ahora.getTime() >= HORAS_MINIMAS_PARA_CANCELAR * 3600e3;
}

/** Reagendar: una sola vez y mientras la clase no haya empezado */
export function puedeReagendar(r: ReservaBasica & { reagendada?: boolean | null }, ahora: Date): boolean {
    if (r.reagendada) return false;
    if (estadoReserva(r, ahora) !== 'proxima') return false;
    const { inicio } = separarHoras(r.horaClase);
    return instante(r.fechaClase, inicio) > ahora;
}
