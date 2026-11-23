// ============================================================================
// NÚCLEO COMPARTIDO DE CLIENTES  ·  archivo 2 de 6 (fechas, cliente.model, cliente.core, codigos, busqueda, menor)
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

// Tutor de un cliente menor de edad (< 18). Obligatorio para crear el registro de un menor.
const tutorSchema = new Schema(
    {
        nombreCompleto: { type: String, required: true, trim: true },
        claveElector: { type: String, required: true, trim: true, uppercase: true },
    },
    { _id: false }
);

// Los 4 documentos adicionales del menor. Se piden una sola vez (no en cada renovación de membresía).
const documentosMenorSchema = new Schema(
    {
        actaNacimiento: { type: Boolean, default: false }, // Acta de nacimiento del menor
        ineTutor: { type: Boolean, default: false }, // INE del padre, madre o tutor
        curpMenor: { type: Boolean, default: false }, // CURP del menor
        credencialEscolar: { type: Boolean, default: false }, // Credencial escolar del menor
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
        // Recuperación de cuenta: código de 6 dígitos (solo se guarda su hash) que vence en 15 minutos.
        recuperacion: {
            type: new Schema({ codigoHash: String, expira: Date, intentos: { type: Number, default: 0 } }, { _id: false }),
            default: null,
            select: false,
        },
        // Se incrementa al cambiar la contraseña desde la web o dar de baja: invalida los tokens ya emitidos.
        tokenVersion: { type: Number, default: 0, select: false },
        ultimoAcceso: Date,

        // Año en que ya se envió la felicitación (evita duplicados si la tarea corre dos veces).
        ultimoSaludoCumple: { type: Number, default: null },

        fechaCreacion: { type: Date, default: Date.now, immutable: true },

        membresia: { type: membresiaSchema, default: null },
        perfilSalud: { type: perfilSaludSchema, default: null },
        perfilActividad: { type: perfilActividadSchema, default: null },

        // Menor de edad: tutor y documentos. El registro puede existir con documentos faltantes;
        // `menorValidado` lo marca el staff en la web cuando el menor ya entregó y se revisaron sus documentos.
        tutor: { type: tutorSchema, default: null },
        documentosMenor: { type: documentosMenorSchema, default: null },
        menorValidado: { type: Boolean, default: false },

        // Cómo se creó el registro: 'web' (recepción) o 'movil' (autorregistro).
        origenRegistro: { type: String, enum: ['web', 'movil'], default: 'web' },
        // Un registro hecho en la app móvil se termina en la plataforma web, al llegar al local.
        registroPendiente: { type: Boolean, default: false },
        // Términos y condiciones: la app móvil no crea la cuenta si no los acepta.
        aceptoTerminos: { type: Boolean, default: false },
        fechaAceptacionTerminos: { type: Date, default: null },
    },
    {
        toJSON: {
            virtuals: true,
            transform(_doc, ret: Record<string, any>) {
                ret.idUsuario = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                delete ret.password;
                delete ret.recuperacion;
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
