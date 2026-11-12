import { Schema, model, InferSchemaType } from 'mongoose';

const claseSchema = new Schema(
    {
        nombre: { type: String, required: true },
        descripcion: { type: String, default: '' },
        capacidad: { type: Number, required: true },
        // Precio de la clase; webCobro lo usa como monto a cobrar en la reservación.
        precio: { type: Number, default: 0 },
        color: { type: String, default: '#10b981' },
        estatus: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
        entrenadorId: { type: String, default: '' },
    },
    {
        toJSON: {
            transform(_doc, ret: Record<string, any>) {
                ret.idClase = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

export type ClaseDoc = InferSchemaType<typeof claseSchema>;
export const Clase = model('Clase', claseSchema, 'webadministrativa_clases');