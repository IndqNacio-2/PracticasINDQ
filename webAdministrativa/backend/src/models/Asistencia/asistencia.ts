import { Schema, model, InferSchemaType } from 'mongoose';
import { fechaLocal } from '../../lib/fecha';

// Un registro por entrada:
//  - tipoPersona 'cliente'  → una visita al gimnasio (reporte de visitas por día/horario)
//  - tipoPersona 'personal' → asistencia, retardo o falta del personal
const registroAsistenciaSchema = new Schema(
    {
        tipoPersona: { type: String, enum: ['cliente', 'personal'], required: true },
        idPersona: { type: String, required: true },
        nombrePersona: { type: String, required: true },
        rol: { type: String, enum: ['administrador', 'entrenador', 'recepcion'] },
        fecha: { type: String, required: true, default: () => fechaLocal() },
        horaEntrada: { type: String, default: '' },
        horaSalida: { type: String, default: '' },
        tipoRegistro: { type: String, enum: ['asistencia', 'retardo', 'falta'], default: 'asistencia' },
    },
    {
        toJSON: {
            transform(_doc, ret: Record<string, any>) {
                ret.id = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

registroAsistenciaSchema.index({ tipoPersona: 1, fecha: 1 });
// El personal tiene un solo registro por día; los clientes pueden visitar varias veces
registroAsistenciaSchema.index(
    { idPersona: 1, fecha: 1 },
    { unique: true, partialFilterExpression: { tipoPersona: 'personal' } }
);

export type RegistroAsistenciaDoc = InferSchemaType<typeof registroAsistenciaSchema>;
export const RegistroAsistencia = model(
    'RegistroAsistencia',
    registroAsistenciaSchema,
    'webadministrativa_asistencias'
);
