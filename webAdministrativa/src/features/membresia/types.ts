import type { Estatus } from '../../types';

// Una presentación de la membresía: cuántas entradas incluye, cuántos días dura y cuánto cuesta.
// Ejemplo: Reset room 12 entradas, 16 días de vigencia.
export interface OpcionMembresia {
    id: string;
    /** Número de accesos; null = ilimitado */
    entradas: number | null;
    vigenciaDias: number;
    /** null = costo por definir */
    costo: number | null;
}

export interface Complementos {
    locker: boolean;
    regaderas: boolean;
    preventas: boolean;
    /** Ej. 10 % en laboratorio; null si no incluye descuento */
    descuento: { porcentaje: number; aplicaEn: string } | null;
}

// Kit de bienvenida (opcional): productos y cortesías
export interface KitBienvenida {
    productos: string[];
    cortesias: string[];
}

export interface Membresia {
    idMembresia: string;
    nombre: string;
    /** Descripción o contenido */
    descripcion: string;
    estatus: Estatus;
    /** Áreas o clases a las que da acceso (lista) */
    accesos: string[];
    opciones: OpcionMembresia[];
    complementos: Complementos;
    kit: KitBienvenida | null;
}

export type MembresiaInput = Omit<Membresia, 'idMembresia'>;