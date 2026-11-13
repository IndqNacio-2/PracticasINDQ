import { Schema, model } from 'mongoose';

// Misma colección que la web administrativa (webadministrativa_horarios).
// Esta API solo lo lee y descuenta/devuelve lugares (capacidadDisponible).
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
    }
);

horarioSchema.index({ fecha: 1, estatus: 1 });

export const Horario = model('Horario', horarioSchema, 'webadministrativa_horarios');
