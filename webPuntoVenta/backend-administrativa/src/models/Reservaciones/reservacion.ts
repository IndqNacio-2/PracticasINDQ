import { Schema, model, InferSchemaType } from 'mongoose';

const reservacionSchema = new Schema(
    {
        idCliente: { type: Schema.Types.String, ref: 'Cliente', required: true },
        nombreCliente: { type: String, required: true },
        idHorario: { type: String, required: true },
        clase: { type: String, required: true },
        entrenador: { type: String, required: true },
        horaClase: { type: String, required: true },
        fechaReservacion: { type: String, required: true },
        estatus: { type: String, enum: ['confirmada', 'pendiente', 'cancelada'], default: 'pendiente' },
        asistenciaConfirmada: { type: Boolean, default: false },
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

export type ReservacionDoc = InferSchemaType<typeof reservacionSchema>;
export const Reservacion = model('Reservacion', reservacionSchema, 'webadministrativa_reservaciones');