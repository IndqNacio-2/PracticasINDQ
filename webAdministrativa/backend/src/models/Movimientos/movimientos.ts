import { Schema, model, InferSchemaType } from 'mongoose';
import { fechaLocal } from '../../lib/fecha';

const movimientoSchema = new Schema(
    {
        idProducto: { type: String, required: true },
        nombreProducto: { type: String, required: true },
        tipo: { type: String, enum: ['entrada', 'salida', 'merma'], required: true },
        cantidad: { type: Number, required: true },
        fecha: { type: String, default: () => fechaLocal() },
        motivo: { type: String, default: '' },
    },
    {
        toJSON: {
            transform(_doc, ret: Record<string, any>) {
                ret.id = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

movimientoSchema.index({ fecha: 1, tipo: 1 });

export type MovimientoDoc = InferSchemaType<typeof movimientoSchema>;
export const Movimiento = model('Movimiento', movimientoSchema, 'webadministrativa_movimientos');
