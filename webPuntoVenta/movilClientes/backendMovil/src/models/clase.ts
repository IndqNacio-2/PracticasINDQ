import { Schema, model } from 'mongoose';

// Misma colección que la web administrativa (webadministrativa_clases).
// precio es NUEVO y opcional: si no existe se usa PRECIO_CLASE_SUELTA del .env.
const claseSchema = new Schema(
    {
        nombre: { type: String, required: true },
        descripcion: { type: String, default: '' },
        capacidad: { type: Number, required: true },
        color: { type: String, default: '#10b981' },
        estatus: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
        entrenadorId: { type: String, default: '' },
        precio: { type: Number },
    }
);

export const Clase = model('Clase', claseSchema, 'webadministrativa_clases');
