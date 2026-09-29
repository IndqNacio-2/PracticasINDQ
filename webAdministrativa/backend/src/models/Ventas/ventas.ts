import { Schema, model, InferSchemaType } from 'mongoose';

const productoVendidoSchema = new Schema(
    {
        nombre: { type: String, required: true },
        cantidad: { type: Number, required: true },
        precio: { type: Number, required: true },
    },
    { _id: false }
);

const ventaSchema = new Schema(
    {
        idCliente: { type: Schema.Types.String, ref: 'Cliente', default: null },
        nombreCliente: { type: String, required: true },
        fecha: { type: String, default: () => new Date().toISOString().slice(0, 10) },
        total: { type: Number, required: true },
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

export type VentaDoc = InferSchemaType<typeof ventaSchema>;
export const Venta = model('Venta', ventaSchema, 'webadministrativa_ventas');