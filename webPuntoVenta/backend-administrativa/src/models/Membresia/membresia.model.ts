import { Schema, model, InferSchemaType } from 'mongoose';

// Una presentación de la membresía: cuántas entradas, cuántos días de vigencia y cuánto cuesta.
// entradas = null → ilimitado; costo = null → por definir
const opcionSchema = new Schema(
    {
        id: { type: String, required: true },
        entradas: { type: Number, default: null },
        vigenciaDias: { type: Number, required: true },
        costo: { type: Number, default: null },
    },
    { _id: false }
);

const membresiaSchema = new Schema(
    {
        nombre: { type: String, required: true, trim: true },
        // Versión en minúsculas para impedir nombres repetidos
        nombreClave: { type: String, required: true, unique: true },
        descripcion: { type: String, default: '' },
        estatus: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
        accesos: { type: [String], default: [] },
        opciones: { type: [opcionSchema], default: [] },
        complementos: {
            locker: { type: Boolean, default: false },
            regaderas: { type: Boolean, default: false },
            preventas: { type: Boolean, default: false },
            descuento: {
                type: new Schema(
                    { porcentaje: { type: Number, required: true }, aplicaEn: { type: String, default: '' } },
                    { _id: false }
                ),
                default: null,
            },
        },
        kit: {
            type: new Schema(
                { productos: { type: [String], default: [] }, cortesias: { type: [String], default: [] } },
                { _id: false }
            ),
            default: null,
        },
        fechaCreacion: { type: Date, default: Date.now },
    },
    {
        toJSON: {
            transform(_doc, ret: Record<string, any>) {
                ret.idMembresia = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                delete ret.nombreClave;
                return ret;
            },
        },
    }
);

export type MembresiaDoc = InferSchemaType<typeof membresiaSchema>;
export const Membresia = model('Membresia', membresiaSchema, 'webadministrativa_membresias');