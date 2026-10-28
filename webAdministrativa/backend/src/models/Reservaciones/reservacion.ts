import { Schema, model, InferSchemaType } from 'mongoose';
import { fechaLocal } from '../../lib/fecha';

const reservacionSchema = new Schema(
    {
        idCliente: { type: String, required: true },
        nombreCliente: { type: String, required: true },
        idHorario: { type: String, required: true },
        clase: { type: String, required: true },
        entrenador: { type: String, default: '' },
        horaClase: { type: String, required: true },
        // Día en que se imparte la clase
        fechaClase: { type: String, required: true },
        // Día en que se hizo la reservación
        fechaReservacion: { type: String, required: true, default: () => fechaLocal() },
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

reservacionSchema.index({ idHorario: 1, estatus: 1 });
reservacionSchema.index({ idCliente: 1 });

export type ReservacionDoc = InferSchemaType<typeof reservacionSchema>;
export const Reservacion = model('Reservacion', reservacionSchema, 'webadministrativa_reservaciones');
