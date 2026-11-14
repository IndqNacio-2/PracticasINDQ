import type { UserRole } from '../models/Usuarios/usuarios';

export const MAX_RESUMEN = 1000;
const MAX_FORMACIONES = 20;
const MAX_DOC_CHARS = 1_500_000; // documento embebido (data URL)

// ---- Roles ----
export type RolApi = 'administrador' | 'entrenador' | 'vendedor';
export const ROLES_API: RolApi[] = ['administrador', 'entrenador', 'vendedor'];

// Los valores de la derecha deben ser EXACTAMENTE los que acepta UserRole
const API_A_DB: Record<RolApi, UserRole> = {
    administrador: 'administrador',
    entrenador: 'entrenador',
    vendedor: 'vendedor',
};

export const rolApiADb = (rol: RolApi): UserRole => API_A_DB[rol];

export const rolDbAApi = (rol: string): RolApi => {
    const hallado = ROLES_API.find((r) => API_A_DB[r] === rol);
    if (!hallado) throw new Error(`Rol desconocido en BD: ${rol}`);
    return hallado;
};

// ---- Columnas (sin password_hash a propósito) ----
export const COLUMNAS_USUARIO = `
  id_usuario, nombre, apellidos, correo, telefono, fecha_nacimiento,
  rol, estatus, especialidad, turno_entrada, turno_salida,
  foto, resumen, capacitaciones, certificaciones
`;

// ---- Tipos ----
export interface Formacion {
    nombre: string;
    institucion?: string;
    fecha?: string;
    documento?: string; // data URL del archivo
}

export interface UsuarioRow {
    id_usuario: number;
    nombre: string;
    apellidos: string;
    correo: string;
    telefono: string | null;
    fecha_nacimiento: string | Date | null;
    rol: string;
    estatus: boolean;
    especialidad: string | null;
    turno_entrada: string | null;
    turno_salida: string | null;
    foto: string | null;
    resumen: string | null;
    capacitaciones: Formacion[] | null;
    certificaciones: Formacion[] | null;
}

type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

// ---- Respuesta pública ----
// incluirDocumentos = true solo en el detalle (GET /:id); en el listado se omiten por peso
export function toPublico(u: UsuarioRow, incluirDocumentos = false) {
    const limpiar = (lista: Formacion[] | null) =>
        (lista ?? []).map((f) => {
            if (incluirDocumentos) return f;
            const { documento, ...resto } = f;
            return { ...resto, tieneDocumento: Boolean(documento) };
        });

    const nac = u.fecha_nacimiento;
    return {
        id: u.id_usuario,
        nombre: u.nombre,
        apellidos: u.apellidos,
        correo: u.correo,
        telefono: u.telefono,
        fechaNacimiento: nac instanceof Date ? nac.toISOString().slice(0, 10) : nac,
        rol: rolDbAApi(u.rol),
        estatus: u.estatus ? 'activo' : 'inactivo',
        especialidad: u.especialidad,
        turnoEntrada: u.turno_entrada,
        turnoSalida: u.turno_salida,
        foto: u.foto,
        resumen: u.resumen,
        capacitaciones: limpiar(u.capacitaciones),
        certificaciones: limpiar(u.certificaciones),
    };
}

// ---- Validaciones ----
export function validarCelular(valor: unknown): Resultado<string | null> {
    if (valor === undefined || valor === null || valor === '') return { ok: true, valor: null };
    const digitos = String(valor).replace(/\D/g, '');
    if (digitos.length !== 10) {
        return { ok: false, error: 'El celular debe tener 10 dígitos' };
    }
    return { ok: true, valor: digitos };
}

export function validarFechaNacimiento(valor: unknown): Resultado<string | null> {
    if (valor === undefined || valor === null || valor === '') return { ok: true, valor: null };
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return { ok: false, error: 'La fecha de nacimiento debe tener formato AAAA-MM-DD' };
    }
    const fecha = new Date(`${valor}T00:00:00Z`);
    if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
        return { ok: false, error: 'La fecha de nacimiento no es válida' };
    }
    const hoy = new Date();
    if (fecha > hoy) return { ok: false, error: 'La fecha de nacimiento no puede ser futura' };
    if (hoy.getUTCFullYear() - fecha.getUTCFullYear() > 100) {
        return { ok: false, error: 'La fecha de nacimiento no es válida' };
    }
    return { ok: true, valor };
}

export function validarFormaciones(valor: unknown, etiqueta: string): Resultado<Formacion[]> {
    if (!Array.isArray(valor)) return { ok: false, error: `${etiqueta} debe ser una lista` };
    if (valor.length > MAX_FORMACIONES) {
        return { ok: false, error: `${etiqueta} admite máximo ${MAX_FORMACIONES} elementos` };
    }

    const salida: Formacion[] = [];
    for (const item of valor) {
        if (!item || typeof item !== 'object') {
            return { ok: false, error: `${etiqueta}: elemento inválido` };
        }
        const { nombre, institucion, fecha, documento } = item as Record<string, unknown>;

        if (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 150) {
            return { ok: false, error: `${etiqueta}: cada elemento necesita un nombre (máx. 150 caracteres)` };
        }
        if (institucion !== undefined && (typeof institucion !== 'string' || institucion.length > 150)) {
            return { ok: false, error: `${etiqueta}: institución inválida` };
        }
        if (fecha !== undefined && (typeof fecha !== 'string' || fecha.length > 20)) {
            return { ok: false, error: `${etiqueta}: fecha inválida` };
        }
        if (documento !== undefined && documento !== null && documento !== '') {
            if (
                typeof documento !== 'string' ||
                documento.length > MAX_DOC_CHARS ||
                !/^data:(application\/pdf|image\/(jpeg|png|webp));base64,[A-Za-z0-9+/]+={0,2}$/.test(documento)
            ) {
                return { ok: false, error: `${etiqueta}: el documento debe ser PDF, JPG, PNG o WEBP y pesar menos de 1 MB` };
            }
        }

        salida.push({
            nombre: nombre.trim(),
            ...(institucion ? { institucion: String(institucion).trim() } : {}),
            ...(fecha ? { fecha: String(fecha) } : {}),
            ...(documento ? { documento: String(documento) } : {}),
        });
    }
    return { ok: true, valor: salida };
}