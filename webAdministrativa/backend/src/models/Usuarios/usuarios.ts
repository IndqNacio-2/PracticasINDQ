import { Schema, model, InferSchemaType } from 'mongoose';

const usuarioSchema = new Schema(
    {
        nombre: { type: String, required: true },
        apellidos: { type: String, required: true },
        correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
        telefono: { type: String, default: '' },
        codigoAcceso: { type: String, required: true, unique: true },
        rol: { type: String, enum: ['administrador', 'entrenador', 'recepcion'], required: true },
        estatus: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
    },
    {
        timestamps: { createdAt: 'fechaCreacion', updatedAt: false },
        toJSON: {
            transform(_doc, ret: Record<string, any>) {
                ret.idUsuario = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

export type UsuarioDoc = InferSchemaType<typeof usuarioSchema>;
export const Usuario = model('Usuario', usuarioSchema, 'webadministrativa_usuarios');