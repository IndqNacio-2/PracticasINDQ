import { Schema, model, InferSchemaType } from 'mongoose';

// Roles de la plataforma (staff). Deben coincidir con el frontend.
// "Cliente" NO está aquí: los clientes se gestionan en el módulo Clientes y no
// inician sesión en la web administrativa.
export type UserRole = 'administrador' | 'entrenador' | 'recepcion' | 'vendedor';

export const MAX_RESUMEN = 1000;

// Capacitación o certificación del coach (se muestra en la app móvil).
// "documento" es opcional: data URL (PDF/JPG/PNG/WEBP) del comprobante.
const formacionSchema = new Schema(
    {
        nombre: { type: String, required: true, trim: true, maxlength: 150 },
        institucion: { type: String, default: '', trim: true, maxlength: 150 },
        fecha: { type: String, default: '' },
        documento: { type: String, default: '' },
    },
    { _id: false }
);

const usuarioSchema = new Schema(
    {
        nombre: { type: String, required: true },
        apellidos: { type: String, required: true },
        correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
        telefono: { type: String, default: '' },
        foto: { type: String, default: '' },
        codigoAcceso: { type: String, required: true, unique: true },
        rol: { type: String, enum: ['administrador', 'entrenador', 'recepcion', 'vendedor'], required: true },
        estatus: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },

        // ---- Datos del coach (solo aplican cuando rol === 'entrenador') ----
        // Resumen de su formación o historia
        resumen: { type: String, default: '', trim: true, maxlength: MAX_RESUMEN },
        capacitaciones: { type: [formacionSchema], default: [] },
        certificaciones: { type: [formacionSchema], default: [] },

        // Contraseña hasheada con bcrypt. No se devuelve por defecto en las
        // consultas (select: false) ni en el JSON (se borra en el transform),
        // así nunca se expone al frontend. Solo auth.login la pide explícitamente.
        password: { type: String, required: true, select: false },
    },
    {
        timestamps: { createdAt: 'fechaCreacion', updatedAt: false },
        toJSON: {
            transform(_doc, ret: Record<string, any>) {
                ret.idUsuario = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                delete ret.password;
                return ret;
            },
        },
    }
);

export type UsuarioDoc = InferSchemaType<typeof usuarioSchema>;
export const Usuario = model('Usuario', usuarioSchema, 'webadministrativa_usuarios');