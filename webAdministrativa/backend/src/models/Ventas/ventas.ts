import { Schema, model, InferSchemaType } from 'mongoose';
import { fechaLocal, horaLocal } from '../../lib/fecha';

const productoVendidoSchema = new Schema(
    {
        idProducto: { type: String, required: true },
        nombre: { type: String, required: true },
        categoria: { type: String, default: '' },
        cantidad: { type: Number, required: true },
        precio: { type: Number, required: true },
    },
    { _id: false }
);

const ventaSchema = new Schema(
    {
        idCliente: { type: String, default: null },
        nombreCliente: { type: String, required: true },
        fecha: { type: String, default: () => fechaLocal() },
        hora: { type: String, default: () => horaLocal() },
        total: { type: Number, required: true },
        metodoPago: { type: String, enum: ['efectivo', 'tarjeta', 'transferencia'], default: 'efectivo' },
        estatus: { type: String, enum: ['completada', 'cancelada'], default: 'completada' },
        productos: { type: [productoVendidoSchema], default: [] },
        recepcionistaId: { type: String, default: '' },
    },
    {
        toJSON: {
            transform(_doc, ret: Record<string, any>) {
                ret.idVenta = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

ventaSchema.index({ fecha: 1 });

export type VentaDoc = InferSchemaType<typeof ventaSchema>;
export const Venta = model('Venta', ventaSchema, 'webadministrativa_ventas');
