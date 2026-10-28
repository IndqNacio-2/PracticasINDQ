import type { UserRole } from '../types/roles';
import { fechaLocal } from './fecha';

// Roles tal como los entiende el frontend
export type RolApi = 'administrador' | 'entrenador' | 'recepcion';
export const ROLES_API: RolApi[] = ['administrador', 'entrenador', 'recepcion'];

// Roles tal como se guardan en Postgres / viajan en el JWT (UserRole de types/roles.ts).
// Si en tu tabla están en otro formato, cámbialo solo aquí.
const ROL_DB: Record<RolApi, string> = {
    administrador: 'Administrador',
    entrenador: 'Entrenador',
    recepcion: 'Recepción',
};

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function rolDbAApi(rol: string): RolApi {
    const n = sinAcentos(rol) as RolApi;
    return ROLES_API.includes(n) ? n : 'recepcion';
}

export function rolApiADb(rol: RolApi): UserRole {
    return ROL_DB[rol] as UserRole;
}

// Documento de respaldo (PDF o imagen) como data URL base64
export interface DocumentoFormacion {
    nombre: string; // nombre del archivo
    data: string;
}

// Capacitación o certificación de un entrenador
export interface Formacion {
    nombre: string;
    fecha: string; // AAAA-MM-DD
    vigencia: string; // AAAA-MM-DD, '' si no tiene
    documento: DocumentoFormacion | null;
}

export const MAX_FOTO_CHARS = 400_000; // ~300 KB de imagen en base64
export const MAX_RESUMEN = 1500;
const MAX_ITEMS = 10;
export const MAX_DOC_CHARS = 700_000; // ~500 KB por documento en base64
const MAX_DOCS_TOTAL_CHARS = 3_000_000; // por lista
const DOC_OK = /^data:(application\/pdf|image\/(png|jpeg|webp));base64,[A-Za-z0-9+/=]+$/;
const FOTO_OK = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

// Devuelve la foto limpia ('' = quitar foto) o un mensaje de error
export function validarFoto(v: unknown): { ok: true; valor: string } | { ok: false; error: string } {
    if (v === null || v === undefined || v === '') return { ok: true, valor: '' };
    if (typeof v !== 'string' || !FOTO_OK.test(v)) {
        return { ok: false, error: 'La foto debe ser una imagen PNG, JPG o WEBP' };
    }
    if (v.length > MAX_FOTO_CHARS) return { ok: false, error: 'La foto es demasiado grande (máximo ~300 KB)' };
    return { ok: true, valor: v };
}

// ¿Es una fecha AAAA-MM-DD real, de 1900 en adelante y no futura?
function esFechaReal(v: unknown, permitirFutura = false): v is string {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const [a, m, d] = v.split('-').map(Number);
    const fecha = new Date(a, m - 1, d);
    if (fecha.getFullYear() !== a || fecha.getMonth() !== m - 1 || fecha.getDate() !== d) return false;
    return a >= 1900 && (permitirFutura || fecha <= new Date());
}

// Fecha de nacimiento: AAAA-MM-DD, real y no futura. Devuelve la fecha limpia o un error.
export function validarFechaNacimiento(v: unknown): { ok: true; valor: string } | { ok: false; error: string } {
    if (!esFechaReal(v)) return { ok: false, error: 'La fecha de nacimiento no es válida (formato AAAA-MM-DD, no futura)' };
    return { ok: true, valor: v };
}

// Celular de 10 a 15 dígitos (se aceptan espacios, guiones, paréntesis y + al inicio). Se guarda solo con dígitos (y +).
export function validarCelular(v: unknown): { ok: true; valor: string } | { ok: false; error: string } {
    const limpio = String(v ?? '').replace(/[\s\-().]/g, '');
    if (!/^\+?\d{10,15}$/.test(limpio)) {
        return { ok: false, error: 'El celular debe tener entre 10 y 15 dígitos' };
    }
    return { ok: true, valor: limpio };
}

// Valida y normaliza una lista de capacitaciones o certificaciones.
// Cada elemento: nombre, fecha, vigencia (opcional) y documento (PDF o imagen). Se ignoran filas sin nombre.
export function validarFormaciones(v: unknown, etiqueta: string): { ok: true; valor: Formacion[] } | { ok: false; error: string } {
    if (v === null || v === undefined) return { ok: true, valor: [] };
    if (!Array.isArray(v)) return { ok: false, error: `${etiqueta} debe ser una lista` };
    if (v.length > MAX_ITEMS) return { ok: false, error: `Máximo ${MAX_ITEMS} ${etiqueta.toLowerCase()}` };

    const et = etiqueta.toLowerCase();
    const valor: Formacion[] = [];
    let totalDocs = 0;
    for (const item of v) {
        const nombre = String(item?.nombre ?? '').trim();
        if (!nombre) continue;
        if (nombre.length > 120) return { ok: false, error: `El nombre de ${et} admite máximo 120 caracteres` };

        const fecha = item?.fecha;
        if (!esFechaReal(fecha)) return { ok: false, error: `Fecha inválida en "${nombre}" (${et})` };

        let vigencia = '';
        if (item?.vigencia !== undefined && item?.vigencia !== null && item?.vigencia !== '') {
            if (!esFechaReal(item.vigencia, true)) return { ok: false, error: `Vigencia inválida en "${nombre}" (${et})` };
            if (item.vigencia < fecha) return { ok: false, error: `La vigencia de "${nombre}" no puede ser anterior a su fecha` };
            vigencia = item.vigencia;
        }

        const doc = item?.documento;
        if (!doc || typeof doc.data !== 'string' || !doc.data) {
            return { ok: false, error: `Falta el documento de "${nombre}" (${et})` };
        }
        if (!DOC_OK.test(doc.data)) return { ok: false, error: `El documento de "${nombre}" debe ser PDF, PNG, JPG o WEBP` };
        if (doc.data.length > MAX_DOC_CHARS) return { ok: false, error: `El documento de "${nombre}" es demasiado grande (máximo ~500 KB)` };
        totalDocs += doc.data.length;
        if (totalDocs > MAX_DOCS_TOTAL_CHARS) return { ok: false, error: `Los documentos de ${et} son demasiado pesados en total` };

        valor.push({
            nombre,
            fecha,
            vigencia,
            documento: { nombre: String(doc.nombre ?? 'documento').trim().slice(0, 120) || 'documento', data: doc.data },
        });
    }
    return { ok: true, valor };
}

export interface UsuarioRow {
    id_usuario: number;
    nombre: string;
    apellidos: string;
    correo: string;
    telefono: string | null;
    fecha_nacimiento: string | null;
    rol: string;
    estatus: boolean;
    especialidad: string | null;
    turno_entrada: string | null;
    turno_salida: string | null;
    foto: string | null;
    resumen: string | null;
    capacitaciones: unknown[] | null;
    certificaciones: unknown[] | null;
    fecha_creacion: Date | null;
    password_hash: string;
}

export const COLUMNAS_USUARIO =
    "id_usuario, nombre, apellidos, correo, telefono, to_char(fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento, rol, estatus, especialidad, turno_entrada, turno_salida, foto, resumen, capacitaciones, certificaciones, fecha_creacion, password_hash";

// Normaliza un elemento guardado (tolera el formato anterior: nombre, institucion, anio)
function normalizarFormacion(raw: unknown): Formacion {
    const it = (raw ?? {}) as Record<string, any>;
    return {
        nombre: String(it.nombre ?? ''),
        fecha: it.fecha ?? (it.anio ? `${it.anio}-01-01` : ''),
        vigencia: it.vigencia ?? '',
        documento: it.documento?.data ? { nombre: String(it.documento.nombre ?? 'documento'), data: it.documento.data } : null,
    };
}

// En listados se omite el contenido de los documentos (solo viaja su nombre) para no cargar de más;
// con completo = true (GET /usuarios/:id) se incluye todo.
function formaciones(lista: unknown[] | null, completo: boolean): Formacion[] {
    return (lista ?? []).map(normalizarFormacion).map((f) =>
        completo || !f.documento ? f : { ...f, documento: { nombre: f.documento.nombre, data: '' } }
    );
}

// Forma pública (sin hash) que consume el frontend
export function toPublico(u: UsuarioRow, completo = false) {
    return {
        idUsuario: String(u.id_usuario),
        nombre: u.nombre,
        apellidos: u.apellidos,
        correo: u.correo,
        telefono: u.telefono ?? '',
        fechaNacimiento: u.fecha_nacimiento ?? '',
        rol: rolDbAApi(u.rol),
        estatus: u.estatus ? ('activo' as const) : ('inactivo' as const),
        especialidad: u.especialidad ?? '',
        turnoEntrada: u.turno_entrada ?? '',
        turnoSalida: u.turno_salida ?? '',
        foto: u.foto ?? '',
        resumen: u.resumen ?? '',
        capacitaciones: formaciones(u.capacitaciones, completo),
        certificaciones: formaciones(u.certificaciones, completo),
        fechaCreacion: u.fecha_creacion ? fechaLocal(u.fecha_creacion) : '',
    };
}