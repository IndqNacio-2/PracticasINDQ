import { Schema, model, InferSchemaType } from 'mongoose';

// Datos del horario original, se guardan al reagendar para conservar el historial.
const origenSchema = new Schema(
    {
        idHorario: String,
        clase: String,
        entrenador: String,
        horaClase: String,
        fechaReservacion: String,
    },
    { _id: false }
);

const reservacionSchema = new Schema(
    {
        // Folio de la reservación (ej. RES-7K2M9Q). Es el que consulta el cliente en la app móvil.
        // sparse: las reservaciones anteriores a este cambio no tienen código y no chocan entre sí.
        codigo: { type: String, unique: true, sparse: true },
        idCliente: { type: Schema.Types.String, ref: 'Cliente', required: true },
        nombreCliente: { type: String, required: true },
        idHorario: { type: String, required: true },
        clase: { type: String, required: true },
        entrenador: { type: String, required: true },
        horaClase: { type: String, required: true },
        // Fecha de la clase reservada, "AAAA-MM-DD".
        fechaReservacion: { type: String, required: true },
        // no_asistio: el cliente no llegó a su clase (sin reembolso y sin reagendar).
        estatus: { type: String, enum: ['confirmada', 'pendiente', 'cancelada', 'no_asistio'], default: 'pendiente' },
        asistenciaConfirmada: { type: Boolean, default: false },

        // Solo se puede reagendar una vez y sin costo.
        reagendada: { type: Boolean, default: false },
        reagendadaDesde: { type: origenSchema, default: null },
        fechaReagendacion: { type: Date, default: null },
        fechaCancelacion: { type: Date, default: null },

        // Declarado a mano (en vez de `timestamps` con nombre personalizado) para no romper los tipos de Mongoose.
        fechaCreacion: { type: Date, default: Date.now, immutable: true },
    },
    {
        toJSON: {
            transform(_doc, ret: Record<string, any>) {
                ret.idReservacion = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

reservacionSchema.index({ idCliente: 1, idHorario: 1 });

export type ReservacionDoc = InferSchemaType<typeof reservacionSchema>;
export const Reservacion = model('Reservacion', reservacionSchema, 'webadministrativa_reservaciones');