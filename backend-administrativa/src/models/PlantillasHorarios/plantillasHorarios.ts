import { Schema, model, InferSchemaType } from 'mongoose';

const plantillaHorarioSchema = new Schema(
    {
        clave: { type: String, required: true, unique: true, trim: true },
        idClase: { type: String, required: true },
        nombreClase: { type: String, required: true },
        entrenadorId: { type: String, default: '' },
        nombreEntrenador: { type: String, default: 'Sin asignar' },
        diaSemana: { type: Number, min: 0, max: 6, required: true },
        horaInicio: { type: String, required: true },
        horaFin: { type: String, required: true },
        capacidadTotal: { type: Number, required: true },
        salon: { type: String, required: true },
        vigenteDesde: { type: String, required: true },
        vigenteHasta: { type: String, default: '' },
        serieId: { type: String, default: '', index: true },
        visibleReservas: { type: Boolean, default: true },
        listaEsperaHabilitada: { type: Boolean, default: false },
        estatus: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
    },
    {
        timestamps: { createdAt: 'fechaCreacion', updatedAt: 'fechaActualizacion' },
        toJSON: {
            transform(_doc, ret: Record<string, any>) {
                ret.idPlantilla = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

plantillaHorarioSchema.index({ diaSemana: 1, horaInicio: 1, salon: 1 });

export type PlantillaHorarioDoc = InferSchemaType<typeof plantillaHorarioSchema>;
export const PlantillaHorario = model(
    'PlantillaHorario',
    plantillaHorarioSchema,
    'webadministrativa_plantillas_horarios'
);