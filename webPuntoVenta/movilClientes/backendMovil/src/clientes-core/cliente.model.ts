// ============================================================================
// NÚCLEO COMPARTIDO DE CLIENTES  ·  archivo 2 de 3 (fechas.ts, cliente.model.ts, cliente.core.ts)
//
// Esta carpeta (src/clientes-core) es IDÉNTICA en:
//   - backend-administrativa/src/clientes-core
//   - movilClientes/backendMovil/src/clientes-core
// Un cambio se hace en una y se copia a la otra. Para comprobar que siguen iguales:
//   diff -r backend-administrativa/src/clientes-core movilClientes/backendMovil/src/clientes-core
// ============================================================================
import { Schema, model, type Model } from 'mongoose';
import { calcularEdad, hoyISO } from './fechas';

/** Colección única de clientes: la comparten la web administrativa y la app móvil. */
export const COLECCION_CLIENTES = 'webadministrativa_clientes';

const membresiaSchema = new Schema(
    {
        idMembresia: { type: String, required: true },
        tipo: { type: String, enum: ['mensual', 'trimestral', 'semestral', 'anual'], required: true },
        fechaInicio: { type: String, required: true },
        fechaFin: { type: String, required: true },
        precio: { type: Number, required: true },
        estatus: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
        // Paquete de clases ("Pilates · 12 clases"). Lo lee y descuenta la app móvil al reservar.
        claseIncluida: { type: String },
        clasesTotal: { type: Number },
        clasesUsadas: { type: Number, default: 0 },
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
        // Foto de perfil como data URL (base64). En la app móvil se llama "foto".
        avatar: String,

        fechaNacimiento: {
            type: String,
            match: [/^\d{4}-\d{2}-\d{2}$/, 'La fecha de nacimiento debe tener formato AAAA-MM-DD'],
        },
        // Se recalcula al guardar la fecha de nacimiento y todos los días con la tarea programada.
        edad: { type: Number, min: 0 },
        direccion: String,
        // Día de alta en la zona horaria del negocio (no en UTC).
        fechaRegistro: { type: String, default: () => hoyISO() },

        // Acceso a la app móvil. password es un hash bcrypt y nunca se devuelve en las consultas.
        password: { type: String, select: false },
        // Se incrementa al cambiar la contraseña desde la web o dar de baja: invalida los tokens ya emitidos.
        tokenVersion: { type: Number, default: 0, select: false },
        ultimoAcceso: Date,

        // Año en que ya se envió la felicitación (evita duplicados si la tarea corre dos veces).
        ultimoSaludoCumple: { type: Number, default: null },

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

// Mantiene la edad al día cada vez que cambia la fecha de nacimiento (alta o edición, web o móvil).
clienteSchema.pre('save', async function (this: any) {
    if (this.isModified('fechaNacimiento')) {
        this.edad = calcularEdad(this.fechaNacimiento) ?? undefined;
    }
});

// Tipado laxo a propósito: la inferencia del esquema rompía los tipos de password, _id, correo...
export const Cliente = model('Cliente', clienteSchema, COLECCION_CLIENTES) as unknown as Model<any>;
