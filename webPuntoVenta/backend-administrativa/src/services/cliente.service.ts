import { Cliente } from '../models/Clientes/cliente';
import { esFechaNacimientoValida } from '../lib/edad';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Opciones {
    /** true = edición (todos los campos son opcionales); false = alta (nombre, apellidos y correo obligatorios). */
    parcial: boolean;
    exigirFechaNacimiento?: boolean;
    /** Permite recibir perfilSalud y perfilActividad (la app móvil sí; el alta del admin no). */
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
 */
export function normalizarPerfil(body: unknown, op: Opciones): ResultadoValidacion {
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

    for (const campo of ['telefono', 'direccion'] as const) {
        if (b[campo] === undefined) continue;
        const t = texto(b[campo], 200);
        if (t === null) return fallo(`El campo ${campo} no es válido (máximo 200 caracteres)`);
        datos[campo] = t;
    }

    if (b.avatar !== undefined) {
        if (b.avatar === null || b.avatar === '') datos.avatar = '';
        else if (typeof b.avatar === 'string' && b.avatar.length <= 1_000_000) datos.avatar = b.avatar;
        else return fallo('La foto no es válida o pesa demasiado');
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

/** Devuelve el mensaje de error de una contraseña inválida, o null si es válida. */
export function errorPassword(valor: unknown): string | null {
    if (typeof valor !== 'string' || valor.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
    if (Buffer.byteLength(valor) > 72) return 'La contraseña es demasiado larga (máximo 72 bytes)';
    return null;
}

/** Crea el cliente con su código de acceso (CLI001, CLI002...). Reintenta si dos altas chocan. */
export async function crearClienteConCodigo(datos: Record<string, unknown>) {
    const total = await Cliente.countDocuments();
    for (let intento = 1; intento <= 5; intento++) {
        try {
            return await Cliente.create({
                ...datos,
                codigoAcceso: `CLI${String(total + intento).padStart(3, '0')}`,
                rol: 'cliente',
            });
        } catch (err: any) {
            const choqueDeCodigo = err?.code === 11000 && err?.keyPattern?.codigoAcceso;
            if (!choqueDeCodigo || intento === 5) throw err;
        }
    }
    throw new Error('No se pudo generar el código de acceso');
}