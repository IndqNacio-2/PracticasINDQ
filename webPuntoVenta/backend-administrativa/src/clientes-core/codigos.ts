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

/**
 * Código Usuario escrito a mano al registrar o editar un cliente en la web (3 a 30 caracteres: letras, números o
 * guiones). Los códigos solo numéricos y los prefijos CLI- y EMP- están reservados. Si se deja vacío se asigna
 * uno automático (CLI001, CLI002...). Misma regla que valida el formulario (validacionCliente.ts).
 */
export function validarCodigoUsuario(valor: unknown): { ok: true; codigo: string } | { ok: false; error: string } {
    const codigo = typeof valor === 'string' ? valor.trim().toUpperCase() : '';
    if (!/^[A-Z0-9][A-Z0-9-]{2,29}$/.test(codigo)) {
        return { ok: false, error: 'El código debe tener de 3 a 30 caracteres: letras, números o guiones.' };
    }
    if (/^\d+$/.test(codigo) || codigo.startsWith('CLI-') || codigo.startsWith('EMP-')) {
        return { ok: false, error: 'Los códigos numéricos y los prefijos CLI- y EMP- están reservados.' };
    }
    return { ok: true, codigo };
}

export function campoDuplicado(err: unknown): string | null {
    const e = err as { code?: number; keyPattern?: Record<string, unknown> };
    if (e?.code !== 11000) return null;
    return Object.keys(e.keyPattern ?? {})[0] ?? 'desconocido';
}