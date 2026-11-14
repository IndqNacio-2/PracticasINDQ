import { Schema, model, InferSchemaType } from 'mongoose';
import { esEnteroPositivo } from '../../lib/validacion';

const claseSchema = new Schema(
    {
        nombre: { type: String, required: [true, 'El nombre de la clase es obligatorio.'], trim: true },
        descripcion: { type: String, default: '' },
        capacidad: { type: Number, required: true, validate: { validator: esEnteroPositivo, message: 'La capacidad debe ser un número entero mayor que cero.' } },
        // Precio de la clase; webCobro lo usa como monto a cobrar en la reservación.
        precio: { type: Number, default: 0, min: [0, 'El precio no puede ser negativo.'], validate: { validator: Number.isFinite, message: 'El precio debe ser un número finito.' } },
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