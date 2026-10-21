import { Schema, model, InferSchemaType } from 'mongoose';

const membresiaSchema = new Schema(
    {
        idMembresia: { type: String, required: true },
        tipo: { type: String, enum: ['mensual', 'trimestral', 'semestral', 'anual'], required: true },
        fechaInicio: { type: String, required: true },
        fechaFin: { type: String, required: true },
        precio: { type: Number, required: true },
        estatus: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
    },
    { _id: false }
);

const perfilSaludSchema = new Schema(
    {
        peso: Number,
        altura: Number,
        tipoSangre: String,
        alergias: { type: [String], default: [] },
        enfermedades: { type: [String], default: [] },
        lesiones: { type: [String], default: [] },
        observaciones: { type: String, default: '' },
    },
    { _id: false }
);

const perfilActividadSchema = new Schema(
    {
        nivelActividad: { type: String, enum: ['sedentario', 'ligero', 'moderado', 'activo', 'muy activo'] },
        objetivo: String,
        hobbies: { type: [String], default: [] },
        frecuenciaEjercicio: String,
    },
    { _id: false }
);

const clienteSchema = new Schema(
    {
        nombre: { type: String, required: true },
        apellidos: { type: String, required: true },
        correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
        telefono: { type: String, default: '' },
        codigoAcceso: { type: String, required: true, unique: true },
        estatus: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
        rol: { type: String, default: 'cliente' },
        avatar: String,
        fechaNacimiento: String,
        direccion: String,
        fechaRegistro: { type: String, default: () => new Date().toISOString().slice(0, 10) },

        membresia: { type: membresiaSchema, default: null },
        perfilSalud: { type: perfilSaludSchema, default: null },
        perfilActividad: { type: perfilActividadSchema, default: null },
    },
    {
        timestamps: { createdAt: 'fechaCreacion', updatedAt: false },
        toJSON: {
            virtuals: true,
            transform(_doc, ret: Record<string, any>) {
                ret.idUsuario = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

export type ClienteDoc = InferSchemaType<typeof clienteSchema>;
export const Cliente = model('Cliente', clienteSchema, 'webadministrativa_clientes');