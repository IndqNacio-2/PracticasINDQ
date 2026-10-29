import { Types } from 'mongoose';
import { Membresia } from '../models/Membresia/membresia.model';

export interface OpcionMembresia { id: string; entradas: number | null; vigenciaDias: number; costo: number | null }
export interface MembresiaDatos {
    nombre: string;
    descripcion: string;
    estatus: 'activo' | 'inactivo';
    accesos: string[];
    opciones: OpcionMembresia[];
    complementos: {
        locker: boolean;
        regaderas: boolean;
        preventas: boolean;
        descuento: { porcentaje: number; aplicaEn: string } | null;
    };
    kit: { productos: string[]; cortesias: string[] } | null;
}

type Resultado = { ok: true; valor: MembresiaDatos } | { ok: false; error: string };

const esTexto = (v: unknown): v is string => typeof v === 'string';

// Limpia una lista de textos: recorta, quita vacíos y repetidos (sin distinguir mayúsculas)
function listaTextos(v: unknown): string[] | null {
    if (!Array.isArray(v) || !v.every(esTexto)) return null;
    const vistos = new Set<string>();
    const salida: string[] = [];
    for (const t of v.map((x) => x.trim()).filter(Boolean)) {
        const k = t.toLowerCase();
        if (!vistos.has(k)) { vistos.add(k); salida.push(t); }
    }
    return salida;
}

// Valida el cuerpo completo de una membresía (alta, o edición ya combinada con lo existente)
export function validarMembresia(b: any): Resultado {
    if (!b || typeof b !== 'object') return { ok: false, error: 'Datos inválidos' };

    const nombre = esTexto(b.nombre) ? b.nombre.trim() : '';
    if (!nombre) return { ok: false, error: 'El nombre de la membresía es obligatorio' };
    if (nombre.length > 80) return { ok: false, error: 'El nombre no puede pasar de 80 caracteres' };

    const descripcion = esTexto(b.descripcion) ? b.descripcion.trim() : '';
    if (descripcion.length > 500) return { ok: false, error: 'La descripción no puede pasar de 500 caracteres' };

    const estatus = b.estatus ?? 'activo';
    if (estatus !== 'activo' && estatus !== 'inactivo') return { ok: false, error: 'Estatus inválido' };

    const accesos = listaTextos(b.accesos);
    if (!accesos || accesos.length === 0) return { ok: false, error: 'Elige al menos un área o clase de acceso' };

    if (!Array.isArray(b.opciones) || b.opciones.length === 0) {
        return { ok: false, error: 'Agrega al menos una opción de entradas, vigencia y costo' };
    }
    const opciones: OpcionMembresia[] = [];
    const vistas = new Set<string>();
    const idsUsados = new Set<string>();
    for (const [i, o] of b.opciones.entries()) {
        const n = i + 1;
        const entradas = o?.entradas === null || o?.entradas === undefined ? null : Number(o.entradas);
        if (entradas !== null && (!Number.isInteger(entradas) || entradas < 1)) {
            return { ok: false, error: `Opción ${n}: las entradas deben ser un entero mayor a 0 (o ilimitado)` };
        }
        const vigenciaDias = Number(o?.vigenciaDias);
        if (!Number.isInteger(vigenciaDias) || vigenciaDias < 1 || vigenciaDias > 3650) {
            return { ok: false, error: `Opción ${n}: los días de vigencia deben ser un entero entre 1 y 3650` };
        }
        const costo = o?.costo === null || o?.costo === undefined || o?.costo === '' ? null : Number(o.costo);
        if (costo !== null && (!Number.isFinite(costo) || costo < 0)) {
            return { ok: false, error: `Opción ${n}: el costo no es válido` };
        }
        const clave = String(entradas);
        if (vistas.has(clave)) return { ok: false, error: 'Hay dos opciones con el mismo número de entradas' };
        vistas.add(clave);

        // Conserva el id que ya traía; si falta o se repite, el servidor genera uno
        let id = esTexto(o?.id) && o.id.trim() && !o.id.startsWith('nueva-') ? o.id.trim() : '';
        if (!id || idsUsados.has(id)) id = `op-${new Types.ObjectId().toString()}`;
        idsUsados.add(id);
        opciones.push({ id, entradas, vigenciaDias, costo: costo === null ? null : Math.round(costo * 100) / 100 });
    }

    const c = b.complementos ?? {};
    let descuento: MembresiaDatos['complementos']['descuento'] = null;
    if (c.descuento) {
        const porcentaje = Number(c.descuento.porcentaje);
        if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
            return { ok: false, error: 'El descuento debe ser un porcentaje entre 1 y 100' };
        }
        descuento = { porcentaje, aplicaEn: esTexto(c.descuento.aplicaEn) ? c.descuento.aplicaEn.trim() : '' };
    }

    let kit: MembresiaDatos['kit'] = null;
    if (b.kit) {
        const productos = listaTextos(b.kit.productos ?? []);
        const cortesias = listaTextos(b.kit.cortesias ?? []);
        if (!productos || !cortesias) return { ok: false, error: 'El kit de bienvenida es inválido' };
        if (productos.length === 0 && cortesias.length === 0) {
            return { ok: false, error: 'El kit de bienvenida no tiene productos ni cortesías' };
        }
        kit = { productos, cortesias };
    }

    return {
        ok: true,
        valor: {
            nombre,
            descripcion,
            estatus,
            accesos,
            opciones,
            complementos: { locker: !!c.locker, regaderas: !!c.regaderas, preventas: !!c.preventas, descuento },
            kit,
        },
    };
}

export const claveNombre = (nombre: string) => nombre.trim().toLowerCase();

// ───────────── Catálogo inicial (especificación 3.1.7) ─────────────
// La especificación da el costo más bajo ($180, tomado como 1 entrada) y el del ilimitado;
// las demás presentaciones quedan "por definir" y se capturan desde la pantalla.
const presentacionesDeClase = (costoIlimitado: number, prefijo: string): OpcionMembresia[] => [
    { id: `${prefijo}-1`, entradas: 1, vigenciaDias: 3, costo: 180 },
    { id: `${prefijo}-6`, entradas: 6, vigenciaDias: 10, costo: null },
    { id: `${prefijo}-12`, entradas: 12, vigenciaDias: 16, costo: null },
    { id: `${prefijo}-20`, entradas: 20, vigenciaDias: 30, costo: null },
    { id: `${prefijo}-60`, entradas: 60, vigenciaDias: 90, costo: null },
    { id: `${prefijo}-ilimitado`, entradas: null, vigenciaDias: 30, costo: costoIlimitado },
];
const SIN = { locker: false, regaderas: false, preventas: false, descuento: null };

export const CATALOGO_INICIAL: MembresiaDatos[] = [
    {
        nombre: 'Open gym', descripcion: 'Únicamente tiene acceso al espacio del gimnasio.', estatus: 'activo', accesos: ['Open gym'],
        opciones: [{ id: 'og-30', entradas: 30, vigenciaDias: 30, costo: 1200 }], complementos: SIN, kit: null
    },
    {
        nombre: 'Reset room', descripcion: 'Sólo clase.', estatus: 'activo', accesos: ['Reset room'],
        opciones: presentacionesDeClase(2500, 'rr'), complementos: SIN, kit: null
    },
    {
        nombre: 'Force room', descripcion: 'Sólo clase.', estatus: 'activo', accesos: ['Force room'],
        opciones: presentacionesDeClase(2900, 'fr'), complementos: SIN, kit: null
    },
    {
        nombre: 'Balance', descripcion: 'Reset room + Force room (ilimitados).', estatus: 'activo', accesos: ['Reset room', 'Force room'],
        opciones: [{ id: 'ba-ilimitado', entradas: null, vigenciaDias: 30, costo: 3300 }], complementos: SIN, kit: null
    },
    {
        nombre: 'Club nuucleo', descripcion: 'Todas las áreas con acceso ilimitado, complementos y kit de bienvenida.', estatus: 'activo',
        accesos: ['Reset room', 'Force room', 'Open gym'],
        opciones: [{ id: 'cn-ilimitado', entradas: null, vigenciaDias: 30, costo: 3900 }],
        complementos: { locker: true, regaderas: true, preventas: true, descuento: { porcentaje: 10, aplicaEn: 'laboratorio' } },
        kit: { productos: ['Termo', 'Toalla', 'Playera'], cortesias: ['3 cortesías para laboratorio'] }
    },
];

// Si no hay ninguna membresía, carga el catálogo inicial. Se llama al arrancar el servidor.
export async function sembrarMembresias(): Promise<number> {
    if ((await Membresia.estimatedDocumentCount()) > 0) return 0;
    await Membresia.insertMany(CATALOGO_INICIAL.map((m) => ({ ...m, nombreClave: claveNombre(m.nombre) })));
    return CATALOGO_INICIAL.length;
}