import { Schema, model, InferSchemaType } from 'mongoose';

const horarioSchema = new Schema(
    {
        idClase: { type: String, required: true },
        nombreClase: { type: String, required: true },
        entrenadorId: { type: String, required: true },
        nombreEntrenador: { type: String, required: true },
        fecha: { type: String, required: true },
        horaInicio: { type: String, required: true },
        horaFin: { type: String, required: true },
        capacidadTotal: { type: Number, required: true },
        capacidadDisponible: { type: Number, required: true },
        estatus: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
        salon: { type: String, required: true },
    },
    {
        toJSON: {
            transform(_doc, ret: Record<string, any>) {
                ret.idHorario = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

export type HorarioDoc = InferSchemaType<typeof horarioSchema>;
export const Horario = model('Horario', horarioSchema, 'webadministrativa_horarios');