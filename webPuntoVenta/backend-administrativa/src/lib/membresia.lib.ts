import { Types } from 'mongoose';
import { Membresia } from '../models/Membresia/membresia.model';

export interface OpcionMembresia { id: string; entradas: number | null; vigenciaDias?: number; costo: number | null; duracion?: number; unidadDuracion?: 'dias' | 'meses'; distribucion?: 'compartida' | 'por_clase'; entradasPorClase?: Record<string, number> }
export interface MembresiaDatos {
    nombre: string;
    descripcion: string;
    estatus: 'activo' | 'inactivo';
    accesos: string[];
    clasesIds?: string[];
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
    if (!b || typeof b !== 'object' || Array.isArray(b)) return { ok: false, error: 'Datos inválidos' };

    const nombre = esTexto(b.nombre) ? b.nombre.trim() : '';
    if (!nombre) return { ok: false, error: 'El nombre de la membresía es obligatorio' };
    if (nombre.length > 80) return { ok: false, error: 'El nombre no puede pasar de 80 caracteres' };

    const descripcion = esTexto(b.descripcion) ? b.descripcion.trim() : '';
    if (descripcion.length > 500) return { ok: false, error: 'La descripción no puede pasar de 500 caracteres' };

    const estatus = b.estatus ?? 'activo';
    if (estatus !== 'activo' && estatus !== 'inactivo') return { ok: false, error: 'Estatus inválido' };

    const modular = b.clasesIds !== undefined;
    let clasesIds: string[] | undefined;
    if (modular) {
        if (!Array.isArray(b.clasesIds) || !b.clasesIds.length || !b.clasesIds.every((id: unknown) => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id))) {
            return { ok: false, error: 'Selecciona al menos una clase válida del catálogo' };
        }
        clasesIds = [...new Set<string>(b.clasesIds)];
    }
    const accesos = listaTextos(b.accesos) ?? [];
    if (!modular && accesos.length === 0) return { ok: false, error: 'Elige al menos un área o clase de acceso' };

    if (!Array.isArray(b.opciones) || b.opciones.length === 0) {
        return { ok: false, error: 'Agrega al menos una opción de entradas, vigencia y costo' };
    }
    const opciones: OpcionMembresia[] = [];
    const vistas = new Set<string>();
    const idsUsados = new Set<string>();
    for (const [i, o] of b.opciones.entries()) {
        const n = i + 1;
        if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, error: `Opción ${n}: datos inválidos` };
        const entradas = o?.entradas === null || o?.entradas === undefined ? null : Number(o.entradas);
        if (entradas !== null && (!Number.isInteger(entradas) || entradas < 1)) {
            return { ok: false, error: `Opción ${n}: las entradas deben ser un entero mayor a 0 (o ilimitado)` };
        }
        const vigenciaDias = modular ? (o.unidadDuracion === 'dias' ? o.duracion : undefined) : Number(o?.vigenciaDias);
        if (!modular && (!Number.isInteger(vigenciaDias) || vigenciaDias! < 1 || vigenciaDias! > 3650)) {
            return { ok: false, error: `Opción ${n}: los días de vigencia deben ser un entero entre 1 y 3650` };
        }
        const costo = o?.costo === null || o?.costo === undefined || o?.costo === '' ? null : Number(o.costo);
        if (costo !== null && (!Number.isFinite(costo) || costo < 0)) {
            return { ok: false, error: `Opción ${n}: el costo no es válido` };
        }
        let configuracion: Partial<OpcionMembresia> = {};
        if (modular) {
            const { duracion, unidadDuracion, distribucion } = o;
            if (!Number.isInteger(duracion) || duracion < 1 || duracion > (unidadDuracion === 'meses' ? 120 : 3650) || !['dias', 'meses'].includes(unidadDuracion)) {
                return { ok: false, error: `Opción ${n}: duración inválida` };
            }
            if (!['compartida', 'por_clase'].includes(distribucion) || costo === null) return { ok: false, error: `Opción ${n}: indica distribución y precio` };
            const entradasPorClase: Record<string, number> = {};
            if (distribucion === 'por_clase') {
                if (entradas === null || !o.entradasPorClase || typeof o.entradasPorClase !== 'object' || Array.isArray(o.entradasPorClase)) return { ok: false, error: 'La distribución por clase requiere cantidades limitadas' };
                if (Object.keys(o.entradasPorClase).some(id => !clasesIds!.includes(id))) return { ok: false, error: 'Hay cantidades para clases no incluidas' };
                for (const id of clasesIds!) {
                    const cantidad = o.entradasPorClase[id];
                    if (!Number.isSafeInteger(cantidad) || cantidad < 1) return { ok: false, error: 'Indica entradas positivas para cada clase' };
                    entradasPorClase[id] = cantidad;
                }
                if (Object.values(entradasPorClase).reduce((a, v) => a + v, 0) !== entradas) return { ok: false, error: 'El total no coincide con las entradas por clase' };
            }
            configuracion = { duracion, unidadDuracion, distribucion, entradasPorClase };
        }
        const clave = modular ? JSON.stringify([entradas, configuracion, costo]) : String(entradas);
        if (vistas.has(clave)) return { ok: false, error: 'Hay dos opciones con el mismo número de entradas' };
        vistas.add(clave);

        // Conserva el id que ya traía; si falta o se repite, el servidor genera uno
        let id = esTexto(o?.id) && o.id.trim() && !o.id.startsWith('nueva-') ? o.id.trim() : '';
        if (!id || idsUsados.has(id)) id = `op-${new Types.ObjectId().toString()}`;
        idsUsados.add(id);
        opciones.push({ ...configuracion, id, entradas, ...(vigenciaDias === undefined ? {} : { vigenciaDias }), costo: costo === null ? null : Math.round(costo * 100) / 100 });
    }

    const c = b.complementos ?? {};
    if (typeof c !== 'object' || Array.isArray(c)) return { ok: false, error: 'Complementos inválidos' };
    for (const campo of ['locker', 'regaderas', 'preventas']) {
        if (c[campo] !== undefined && typeof c[campo] !== 'boolean') return { ok: false, error: 'Complementos inválidos' };
    }
    let descuento: MembresiaDatos['complementos']['descuento'] = null;
    if (c.descuento) {
        if (typeof c.descuento !== 'object' || Array.isArray(c.descuento)) return { ok: false, error: 'Descuento inválido' };
        const porcentaje = Number(c.descuento.porcentaje);
        if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
            return { ok: false, error: 'El descuento debe ser un porcentaje entre 1 y 100' };
        }
        descuento = { porcentaje, aplicaEn: esTexto(c.descuento.aplicaEn) ? c.descuento.aplicaEn.trim() : '' };
    }

    let kit: MembresiaDatos['kit'] = null;
    if (b.kit) {
        if (typeof b.kit !== 'object' || Array.isArray(b.kit)) return { ok: false, error: 'El kit de bienvenida es inválido' };
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
            ...(clasesIds ? { clasesIds } : {}),
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

// Carga explícita y no destructiva: jamás se llama al arrancar ni desde un GET.
export async function sembrarMembresias(): Promise<number> {
    let creadas = 0;
    for (const membresia of CATALOGO_INICIAL) {
        const nombreClave = claveNombre(membresia.nombre);
        const resultado = await Membresia.updateOne(
            { nombreClave },
            { $setOnInsert: { ...membresia, nombreClave } },
            { upsert: true },
        );
        creadas += resultado.upsertedCount;
    }
    return creadas;
}