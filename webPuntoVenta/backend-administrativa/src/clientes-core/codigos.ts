// ============================================================================
// NÚCLEO COMPARTIDO DE CLIENTES  ·  codigos.ts
// Carpeta idéntica en backend-administrativa y movilClientes/backendMovil (ver cliente.model.ts).
//
// Nomenclatura única de códigos: PREFIJO-XXXXX  ("prefijo" + "-" + 5 dígitos).
//   NU = reservación de clase individual      (NU-48213)
//   PQ = membresía / paquete apartado         (PQ-07391)
// ============================================================================
import { randomInt } from 'node:crypto';

export const PREFIJOS_CODIGO = ['NU', 'PQ'] as const;
export type PrefijoCodigo = (typeof PREFIJOS_CODIGO)[number];

export const PREFIJO_RESERVACION: PrefijoCodigo = 'NU';
export const PREFIJO_MEMBRESIA: PrefijoCodigo = 'PQ';

/** Genera un código nuevo, por ejemplo NU-04821. Quien lo guarde debe reintentar si choca con uno existente. */
export function generarCodigo(prefijo: PrefijoCodigo): string {
    return `${prefijo}-${String(randomInt(0, 100_000)).padStart(5, '0')}`;
}

const FORMATO = /^(NU|PQ)-\d{5}$/;

/** Limpia lo que escribe el usuario (espacios, minúsculas) y devuelve el código, o null si no tiene el formato. */
export function normalizarCodigo(valor: unknown): string | null {
    if (typeof valor !== 'string') return null;
    const limpio = valor.trim().toUpperCase();
    return FORMATO.test(limpio) ? limpio : null;
}

export function campoDuplicado(err: unknown): string | null {
    const e = err as { code?: number; keyPattern?: Record<string, unknown> };
    if (e?.code !== 11000) return null;
    return Object.keys(e.keyPattern ?? {})[0] ?? 'desconocido';
}
