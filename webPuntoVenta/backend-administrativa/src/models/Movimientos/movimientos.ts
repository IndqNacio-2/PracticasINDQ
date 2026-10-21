import { Schema, model, InferSchemaType } from 'mongoose';

const movimientoSchema = new Schema(
    {
        idProducto: { type: Schema.Types.String, ref: 'Producto', required: true },
        nombreProducto: { type: String, required: true },
        tipo: { type: String, enum: ['entrada', 'salida', 'merma'], required: true },
        cantidad: { type: Number, required: true },
        fecha: { type: String, default: () => new Date().toISOString().slice(0, 10) },
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

export type MovimientoDoc = InferSchemaType<typeof movimientoSchema>;
export const Movimiento = model('Movimiento', movimientoSchema, 'webadministrativa_movimientos');