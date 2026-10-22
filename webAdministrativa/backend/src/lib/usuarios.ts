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

export interface UsuarioRow {
    id_usuario: number;
    nombre: string;
    apellidos: string;
    correo: string;
    telefono: string | null;
    codigo_acceso: string | null;
    rol: string;
    estatus: boolean;
    especialidad: string | null;
    turno_entrada: string | null;
    turno_salida: string | null;
    fecha_creacion: Date | null;
    password_hash: string;
}

export const COLUMNAS_USUARIO =
    'id_usuario, nombre, apellidos, correo, telefono, codigo_acceso, rol, estatus, especialidad, turno_entrada, turno_salida, fecha_creacion, password_hash';

// Forma pública (sin hash) que consume el frontend
export function toPublico(u: UsuarioRow) {
    return {
        idUsuario: String(u.id_usuario),
        nombre: u.nombre,
        apellidos: u.apellidos,
        correo: u.correo,
        telefono: u.telefono ?? '',
        codigoAcceso: u.codigo_acceso ?? '',
        rol: rolDbAApi(u.rol),
        estatus: u.estatus ? ('activo' as const) : ('inactivo' as const),
        especialidad: u.especialidad ?? '',
        turnoEntrada: u.turno_entrada ?? '',
        turnoSalida: u.turno_salida ?? '',
        fechaCreacion: u.fecha_creacion ? fechaLocal(u.fecha_creacion) : '',
    };
}
