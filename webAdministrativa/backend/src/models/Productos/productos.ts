import { Schema, model, InferSchemaType } from 'mongoose';

const productoSchema = new Schema(
    {
        nombre: { type: String, required: true },
        descripcion: { type: String, default: '' },
        precio: { type: Number, required: true },
        stock: { type: Number, required: true, default: 0 },
        categoria: { type: String, required: true },
        estatus: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
    },
    {
        toJSON: {
            transform(_doc, ret: Record<string, any>) {
                ret.idProducto = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

export type ProductoDoc = InferSchemaType<typeof productoSchema>;
export const Producto = model('Producto', productoSchema, 'webadministrativa_productos');