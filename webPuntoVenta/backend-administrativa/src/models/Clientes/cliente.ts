import { Schema, model, InferSchemaType } from 'mongoose';
import { calcularEdad } from '../../lib/edad';

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
        nombre: { type: String, required: true, trim: true },
        apellidos: { type: String, required: true, trim: true },
        correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
        telefono: { type: String, default: '' },
        codigoAcceso: { type: String, required: true, unique: true },
        // La baja es lógica: el cliente nunca se elimina, solo pasa a 'inactivo'.
        estatus: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
        fechaBaja: { type: String, default: null },
        rol: { type: String, default: 'cliente' },
        avatar: String,

        fechaNacimiento: {
            type: String,
            match: [/^\d{4}-\d{2}-\d{2}$/, 'La fecha de nacimiento debe tener formato AAAA-MM-DD'],
        },
        // Se recalcula al guardar la fecha de nacimiento y todos los días con la tarea programada.
        edad: { type: Number, min: 0 },
        direccion: String,
        fechaRegistro: { type: String, default: () => new Date().toISOString().slice(0, 10) },

        // Acceso desde la app móvil. password es un hash bcrypt y nunca se devuelve en las consultas.
        password: { type: String, select: false },
        // Se incrementa al cerrar sesión, cambiar contraseña o dar de baja: invalida los tokens emitidos.
        tokenVersion: { type: Number, default: 0, select: false },
        ultimoAcceso: Date,

        // Año en que ya se envió la felicitación (evita duplicados si la tarea corre dos veces).
        ultimoSaludoCumple: { type: Number, default: null },

        // Antes venía de `timestamps: { createdAt: 'fechaCreacion', updatedAt: false }`. Esa opción
        // con nombre personalizado hacía que TypeScript infiriera el modelo con una firma
        // `[x: string]: NativeDate` (la causa de los errores de tipos con password, correo, _id...).
        // Declarar el campo a mano da el mismo resultado sin romper la inferencia.
        fechaCreacion: { type: Date, default: Date.now, immutable: true },

        membresia: { type: membresiaSchema, default: null },
        perfilSalud: { type: perfilSaludSchema, default: null },
        perfilActividad: { type: perfilActividadSchema, default: null },
    },
    {
        toJSON: {
            virtuals: true,
            transform(_doc, ret: Record<string, any>) {
                ret.idUsuario = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                delete ret.password;
                delete ret.tokenVersion;
                return ret;
            },
        },
    }
);

// Mantiene la edad al día cada vez que cambia la fecha de nacimiento.
clienteSchema.pre('save', async function () {
    if (this.isModified('fechaNacimiento')) {
        this.edad = calcularEdad(this.fechaNacimiento) ?? undefined;
    }
});

export type ClienteDoc = InferSchemaType<typeof clienteSchema>;
export const Cliente = model('Cliente', clienteSchema, 'webadministrativa_clientes');