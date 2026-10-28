import { randomInt } from 'node:crypto';

// Sin caracteres que se confunden (I, O, 0, 1)
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function aleatorio(largo: number): string {
    return Array.from({ length: largo }, () => ABC[randomInt(ABC.length)]).join('');
}

const PREFIJO = process.env.CODIGO_PREFIJO ?? 'NU';

/** Código de reservación que va dentro del QR, por ejemplo NU-H2W7D */
export const codigoReservacion = () => `${PREFIJO}-${aleatorio(5)}`;

/** Código de acceso del cliente (el modelo compartido lo exige y es único) */
export const codigoAccesoCliente = () => `CL-${aleatorio(8)}`;

/** ¿El error de Mongo es por un valor duplicado? Devuelve el campo repetido */
export function campoDuplicado(err: unknown): string | null {
    const e = err as { code?: number; keyPattern?: Record<string, unknown> };
    if (e?.code !== 11000) return null;
    return Object.keys(e.keyPattern ?? {})[0] ?? 'desconocido';
}
