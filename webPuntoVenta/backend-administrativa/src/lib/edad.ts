// Utilidades de fechas "YYYY-MM-DD" para edad y cumpleaños.
// Todo se calcula en la zona horaria del negocio (no la del servidor).

export interface Fecha { y: number; m: number; d: number }

export const ZONA_HORARIA = process.env.APP_TZ || 'America/Mazatlan';

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function esBisiesto(y: number): boolean {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Convierte "YYYY-MM-DD" en Fecha. Devuelve null si el formato o el día no existen. */
export function parseFechaISO(valor?: string | null): Fecha | null {
    if (!valor) return null;
    const m = ISO.exec(valor);
    if (!m) return null;
    const f: Fecha = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
    const dias = [31, esBisiesto(f.y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (f.m < 1 || f.m > 12 || f.d < 1 || f.d > dias[f.m - 1]) return null;
    return f;
}

/** "Hoy" en la zona horaria indicada. */
export function hoyEnZona(tz: string = ZONA_HORARIA): Fecha {
    const txt = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date()); // "2026-11-06"
    const [y, m, d] = txt.split('-').map(Number);
    return { y, m, d };
}

export function fechaISO(f: Fecha): string {
    return `${f.y}-${String(f.m).padStart(2, '0')}-${String(f.d).padStart(2, '0')}`;
}

/** Edad cumplida a la fecha `hoy`. Null si la fecha de nacimiento no es válida. */
export function calcularEdad(fechaNacimiento?: string | null, hoy: Fecha = hoyEnZona()): number | null {
    const n = parseFechaISO(fechaNacimiento);
    if (!n) return null;
    let edad = hoy.y - n.y;
    if (hoy.m < n.m || (hoy.m === n.m && hoy.d < n.d)) edad--;
    return edad >= 0 ? edad : null;
}

/** ¿Cumple años `hoy`? Quien nació un 29 de febrero se felicita el 28 en años no bisiestos. */
export function esCumpleanos(fechaNacimiento?: string | null, hoy: Fecha = hoyEnZona()): boolean {
    const n = parseFechaISO(fechaNacimiento);
    if (!n) return false;
    if (n.m === 2 && n.d === 29 && !esBisiesto(hoy.y)) return hoy.m === 2 && hoy.d === 28;
    return n.m === hoy.m && n.d === hoy.d;
}

/** Fecha de nacimiento válida: existe, no es futura y la edad no supera 120 años. */
export function esFechaNacimientoValida(valor: unknown): boolean {
    if (typeof valor !== 'string') return false;
    const edad = calcularEdad(valor);
    return edad !== null && edad <= 120;
}