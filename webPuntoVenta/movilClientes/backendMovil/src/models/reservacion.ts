import { Schema, model } from 'mongoose';
import { fechaLocal } from '../lib/fecha';

// Misma colección que la web administrativa (webadministrativa_reservaciones).
// Campos NUEVOS (opcionales): codigo, pagoTipo, monto, reagendada, fechaCancelacion.
// Las reservaciones creadas desde la web administrativa no tienen código.
const reservacionSchema = new Schema(
    {
        idCliente: { type: String, required: true },
        nombreCliente: { type: String, required: true },
        idHorario: { type: String, required: true },
        clase: { type: String, required: true },
        entrenador: { type: String, default: '' },
        // "06:00 - 06:50"
        horaClase: { type: String, required: true },
        // Día en que se imparte la clase
        fechaClase: { type: String, required: true },
        // Día en que se hizo la reservación
        fechaReservacion: { type: String, required: true, default: () => fechaLocal() },
        estatus: { type: String, enum: ['confirmada', 'pendiente', 'cancelada'], default: 'pendiente' },
        // Lo marca recepción al escanear el código (hasta 10 minutos antes de la clase)
        asistenciaConfirmada: { type: Boolean, default: false },

        // NUEVO
        codigo: { type: String },
        pagoTipo: { type: String, enum: ['paquete', 'recepcion'] },
        monto: { type: Number, default: 0 },
        reagendada: { type: Boolean, default: false },
        fechaCancelacion: { type: String },
    }
);

reservacionSchema.index({ idHorario: 1, estatus: 1 });
reservacionSchema.index({ idCliente: 1 });
reservacionSchema.index({ codigo: 1 }, { unique: true, partialFilterExpression: { codigo: { $type: 'string' } } });

export const Reservacion = model('Reservacion', reservacionSchema, 'webadministrativa_reservaciones');
