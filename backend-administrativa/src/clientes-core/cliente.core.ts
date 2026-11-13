// ============================================================================
// NÚCLEO COMPARTIDO DE CLIENTES  ·  archivo 3 de 3 (fechas.ts, cliente.model.ts, cliente.core.ts)
// Carpeta idéntica en backend-administrativa y movilClientes/backendMovil (ver cliente.model.ts).
//
// Aquí vive UNA sola implementación de: validación de datos del cliente, reglas de contraseña,
// generación del código de acceso y alta de cliente. La web (recepción) y la app móvil
// (autorregistro) llaman a registrarCliente(); lo único que cambia es el `origen`.
// ============================================================================
import bcrypt from 'bcryptjs';
import { Cliente } from './cliente.model';
import { esFechaNacimientoValida } from './fechas';

export type Origen = 'web' | 'movil';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FOTO_OK = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_FOTO_CHARS = 400_000; // ~300 KB de imagen en base64

export const MENSAJE_SIN_ACTIVAR =
    'Tu cuenta aún no tiene contraseña. Actívala con el código de acceso que te dieron en el gimnasio';

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------
export interface OpcionesPerfil {
    /** true = edición (todos los campos son opcionales); false = alta (nombre, apellidos y correo obligatorios). */
    parcial: boolean;
    exigirFechaNacimiento?: boolean;
    /** Exige un celular válido (la app móvil lo pide al registrarse; en recepción es opcional). */
    exigirTelefono?: boolean;
    /** Permite recibir perfilSalud y perfilActividad (la app móvil sí; el alta de recepción no). */
    permitirPerfiles?: boolean;
}

export interface ResultadoValidacion {
    error?: string;
    datos: Record<string, unknown>;
}

function texto(valor: unknown, max: number): string | null {
    if (typeof valor !== 'string') return null;
    const t = valor.trim();
    return t.length <= max ? t : null;
}

function esObjetoPlano(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Valida y filtra el body: solo pasan los campos permitidos, así nadie puede
 * cambiar estatus, codigoAcceso, rol, membresía ni password por esta vía.
 * Acepta la foto como `avatar` (web) o `foto` (móvil); se guarda siempre como `avatar`.
 */
export function normalizarPerfil(body: unknown, op: OpcionesPerfil): ResultadoValidacion {
    const b: Record<string, any> = esObjetoPlano(body) ? body : {};
    const datos: Record<string, unknown> = {};
    const fallo = (error: string): ResultadoValidacion => ({ error, datos });

    for (const [campo, etiqueta] of [['nombre', 'El nombre'], ['apellidos', 'Los apellidos']] as const) {
        if (b[campo] === undefined) {
            if (!op.parcial) return fallo(`${etiqueta} es obligatorio`);
            continue;
        }
        const t = texto(b[campo], 80);
        if (!t || t.length < 2) return fallo(`${etiqueta} debe tener entre 2 y 80 caracteres`);
        datos[campo] = t;
    }

    if (b.correo === undefined) {
        if (!op.parcial) return fallo('El correo es obligatorio');
    } else {
        const correo = texto(b.correo, 120)?.toLowerCase();
        if (!correo || !EMAIL.test(correo)) return fallo('El correo no es válido');
        datos.correo = correo;
    }

    // Celular: se aceptan espacios, guiones, paréntesis y + al inicio; se guarda solo con dígitos (y el +).
    const faltaTel = b.telefono === undefined || b.telefono === null || String(b.telefono).trim() === '';
    if (faltaTel) {
        if (op.exigirTelefono && !(op.parcial && b.telefono === undefined)) {
            return fallo('El celular debe tener entre 10 y 15 dígitos');
        }
        if (b.telefono !== undefined) datos.telefono = '';
    } else {
        const limpio = String(b.telefono).replace(/[\s\-().]/g, '');
        if (!/^\+?\d{10,15}$/.test(limpio)) return fallo('El celular debe tener entre 10 y 15 dígitos');
        datos.telefono = limpio;
    }

    if (b.direccion !== undefined) {
        const t = texto(b.direccion, 200);
        if (t === null) return fallo('La dirección no es válida (máximo 200 caracteres)');
        datos.direccion = t;
    }

    const foto = b.avatar !== undefined ? b.avatar : b.foto;
    if (foto !== undefined) {
        if (foto === null || foto === '') datos.avatar = '';
        else if (typeof foto !== 'string' || !FOTO_OK.test(foto)) return fallo('La foto debe ser una imagen PNG, JPG o WEBP');
        else if (foto.length > MAX_FOTO_CHARS) return fallo('La foto es demasiado grande (máximo ~300 KB)');
        else datos.avatar = foto;
    }

    const fn = b.fechaNacimiento;
    if (fn === undefined) {
        if (op.exigirFechaNacimiento && !op.parcial) return fallo('La fecha de nacimiento es obligatoria');
    } else if (fn === null || fn === '') {
        if (op.exigirFechaNacimiento) return fallo('La fecha de nacimiento es obligatoria');
        datos.fechaNacimiento = null;
    } else if (!esFechaNacimientoValida(fn)) {
        return fallo('La fecha de nacimiento no es válida (usa AAAA-MM-DD y no puede ser futura)');
    } else {
        datos.fechaNacimiento = fn;
    }

    if (op.permitirPerfiles) {
        for (const campo of ['perfilSalud', 'perfilActividad'] as const) {
            if (b[campo] === undefined) continue;
            if (b[campo] !== null && !esObjetoPlano(b[campo])) return fallo(`${campo} debe ser un objeto`);
            datos[campo] = b[campo];
        }
    }

    return { datos };
}

/** Devuelve el mensaje de error de una contraseña inválida, o null si es válida. Misma regla en web y móvil. */
export function errorPassword(valor: unknown): string | null {
    if (typeof valor !== 'string' || valor.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (Buffer.byteLength(valor) > 72) return 'La contraseña es demasiado larga (máximo 72 bytes)';
    return null;
}

// ---------------------------------------------------------------------------
// Código de acceso (CLI001, CLI002...) con contador atómico
// ---------------------------------------------------------------------------
const COLECCION_CONTADORES = 'webadministrativa_contadores';
const ID_CONTADOR = 'codigoAccesoCliente';
let contadorAlineado = false;

function contadores() {
    return Cliente.db.collection<{ _id: string; seq: number }>(COLECCION_CONTADORES);
}

/** Sube el contador hasta el mayor CLI### que ya exista (clientes viejos), sin bajarlo nunca. */
async function alinearContador(): Promise<void> {
    const [fila] = await Cliente.aggregate([
        { $match: { codigoAcceso: /^CLI\d+$/ } },
        { $project: { n: { $toLong: { $substrBytes: ['$codigoAcceso', 3, 20] } } } },
        { $group: { _id: null, max: { $max: '$n' } } },
    ]);
    try {
        await contadores().updateOne({ _id: ID_CONTADOR }, { $max: { seq: Number(fila?.max ?? 0) } }, { upsert: true });
    } catch (err: any) {
        if (err?.code !== 11000) throw err; // otro proceso lo creó al mismo tiempo: está bien
    }
}

async function siguienteCodigo(): Promise<string> {
    if (!contadorAlineado) {
        await alinearContador();
        contadorAlineado = true;
    }
    const fila = await contadores().findOneAndUpdate(
        { _id: ID_CONTADOR },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
    );
    return `CLI${String(fila!.seq).padStart(3, '0')}`;
}

/** ¿El error de Mongo es por un valor duplicado? Devuelve el campo repetido. */
export function campoDuplicado(err: unknown): string | null {
    const e = err as { code?: number; keyPattern?: Record<string, unknown> };
    if (e?.code !== 11000) return null;
    return Object.keys(e.keyPattern ?? {})[0] ?? 'desconocido';
}

// ---------------------------------------------------------------------------
// Alta de cliente (única para web y móvil)
// ---------------------------------------------------------------------------
export type ResultadoRegistro =
    | { ok: true; cliente: any }
    | { ok: false; status: number; error: string; codigo?: string };

const falla = (status: number, error: string, codigo?: string): ResultadoRegistro => ({ ok: false, status, error, codigo });

/**
 * Registra un cliente en la colección compartida.
 *  - 'web'   : lo da de alta recepción. Celular y contraseña opcionales (sin contraseña, el cliente
 *              la crea después en la app con su código de acceso).
 *  - 'movil' : autorregistro. Celular y contraseña (con confirmación) obligatorios; acepta perfiles de salud/actividad.
 * Siempre: estatus activo, rol cliente, sin membresía, código de acceso CLI### y edad calculada.
 */
export async function registrarCliente(body: unknown, origen: Origen): Promise<ResultadoRegistro> {
    const b: Record<string, any> = esObjetoPlano(body) ? body : {};
    const movil = origen === 'movil';

    const { error, datos } = normalizarPerfil(b, {
        parcial: false,
        exigirFechaNacimiento: true,
        exigirTelefono: movil,
        permitirPerfiles: movil,
    });
    if (error) return falla(400, error);

    const traePassword = b.password !== undefined && b.password !== '';
    if (movil || traePassword) {
        const errPass = errorPassword(b.password);
        if (errPass) return falla(400, errPass);
        if (movil && b.confirmarPassword !== b.password) return falla(400, 'Las contraseñas no coinciden');
    }

    const mensajeDuplicado = movil ? 'Ya existe una cuenta con ese correo' : 'Ya existe un cliente registrado con ese correo';
    const existente = await Cliente.findOne({ correo: datos.correo }).select('+password');
    if (existente) {
        // Dado de alta en recepción y sin contraseña: en la app debe activarla, no registrarse de nuevo.
        if (movil && !existente.password) return falla(409, MENSAJE_SIN_ACTIVAR, 'CUENTA_SIN_ACTIVAR');
        return falla(409, mensajeDuplicado);
    }

    if (traePassword) datos.password = await bcrypt.hash(b.password, 10);
    if (datos.avatar === '') delete datos.avatar;

    for (let intento = 0; intento < 8; intento++) {
        try {
            const cliente = await Cliente.create({
                ...datos,
                codigoAcceso: await siguienteCodigo(),
                estatus: 'activo',
                rol: 'cliente',
                membresia: null,
            });
            return { ok: true, cliente };
        } catch (err) {
            const campo = campoDuplicado(err);
            if (campo === 'correo') return falla(409, mensajeDuplicado); // dos altas simultáneas con el mismo correo
            if (campo !== 'codigoAcceso') throw err;
            await alinearContador(); // el código ya existía: se alinea el contador y se reintenta
        }
    }
    throw new Error('No se pudo generar el código de acceso');
}
