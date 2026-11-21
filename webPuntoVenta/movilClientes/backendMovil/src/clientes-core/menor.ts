// ============================================================================
// NÚCLEO COMPARTIDO DE CLIENTES  ·  menor.ts
// Carpeta idéntica en backend-administrativa y movilClientes/backendMovil (ver cliente.model.ts).
//
// Reglas de los clientes menores de edad (< 18 años):
//   - OBLIGATORIOS para crear el registro: nombre completo del tutor y clave de elector del tutor.
//   - 4 documentos adicionales: el registro se puede crear aunque falte alguno.
//   - Un campo indica si el menor ya fue validado con sus documentos. Se piden UNA sola vez:
//     renovar o comprar otra membresía no vuelve a pedirlos.
// ============================================================================
import { calcularEdad } from './fechas';

export const EDAD_MAYORIA = 18;
export const TOTAL_DOCUMENTOS_MENOR = 4;

export const esMenorDeEdad = (fechaNacimiento?: string | null): boolean => {
    const edad = calcularEdad(fechaNacimiento);
    return edad !== null && edad < EDAD_MAYORIA;
};

// Claves de los 4 documentos. (Pendiente: poner aquí los nombres reales cuando se definan.)
export const CLAVES_DOCUMENTOS = ['documento1', 'documento2', 'documento3', 'documento4'] as const;

const CLAVE_ELECTOR = /^[A-Za-z0-9]{18}$/; // la clave de elector del INE tiene 18 caracteres

function texto(v: unknown, max: number): string | null {
    if (typeof v !== 'string') return null;
    const t = v.trim().replace(/\s+/g, ' ');
    return t.length >= 1 && t.length <= max ? t : null;
}

export interface DatosTutor {
    nombreCompleto: string;
    claveElector: string;
}

/**
 * Valida el tutor que llega en el body: `tutor: { nombreCompleto, claveElector }`
 * (también acepta tutorNombre / claveElector sueltos, por comodidad de la app móvil;
 * si vienen sueltos, tienen prioridad sobre los de `tutor`).
 */
export function validarTutor(body: Record<string, any>): { error: string } | { tutor: DatosTutor } {
    const t = typeof body.tutor === 'object' && body.tutor !== null ? body.tutor : {};
    const nombre = texto(body.tutorNombre ?? body.nombreTutor ?? t.nombreCompleto, 120);
    if (!nombre || nombre.split(' ').length < 2) {
        return { error: 'El cliente es menor de edad: el nombre completo del tutor es obligatorio' };
    }
    const clave = String(body.claveElector ?? t.claveElector ?? '').trim().toUpperCase();
    if (!CLAVE_ELECTOR.test(clave)) {
        return { error: 'El cliente es menor de edad: la clave de elector del tutor es obligatoria (18 caracteres)' };
    }
    return { tutor: { nombreCompleto: nombre, claveElector: clave } };
}

export interface EstadoDocumentos {
    documentos: Record<string, boolean>;
    /** true cuando el menor ya fue validado con sus documentos (no se vuelven a pedir). */
    validado: boolean;
}

/** Documentos entregados (por clave) → estado completo. `validado` solo lo marca el staff. */
export function normalizarDocumentos(entrada: unknown, validado: unknown): EstadoDocumentos {
    const e = typeof entrada === 'object' && entrada !== null ? (entrada as Record<string, unknown>) : {};
    const documentos: Record<string, boolean> = {};
    for (const clave of CLAVES_DOCUMENTOS) documentos[clave] = e[clave] === true;
    return { documentos, validado: validado === true };
}
