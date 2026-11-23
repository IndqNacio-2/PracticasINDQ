import { Schema, model } from 'mongoose';
import { fechaLocal } from '../lib/fecha';

// Misma colección y MISMO esquema que la web administrativa y cobro (webadministrativa_reservaciones):
// una sola definición de reservación para todos los módulos. Si cambias un campo aquí, cámbialo en
// backend-administrativa/src/models/Reservaciones/reservacion.ts.
const origenSchema = new Schema(
    {
        idHorario: String,
        clase: String,
        entrenador: String,
        horaClase: String,
        fechaClase: String,
    },
    { _id: false }
);

const reservacionSchema = new Schema(
    {
        codigo: { type: String },
        // 'cliente' = persona registrada; 'visitante' = sin ficha (solo lo crea recepción).
        tipo: { type: String, enum: ['cliente', 'visitante'], default: 'cliente' },
        idCliente: { type: String, required: true },
        nombreCliente: { type: String, required: true },
        idHorario: { type: String, required: true },
        clase: { type: String, required: true },
        claseId: { type: String, default: '' },
        entrenador: { type: String, default: '' },
        // "06:00 - 06:50"
        horaClase: { type: String, required: true },
        // Día en que se imparte la clase
        fechaClase: { type: String, required: true },
        // Día en que se hizo la reservación
        fechaReservacion: { type: String, default: () => fechaLocal() },
        estatus: { type: String, enum: ['confirmada', 'pendiente', 'cancelada', 'no_asistio'], default: 'pendiente' },
        // Lo marca recepción al escanear el código (hasta 10 minutos antes de la clase)
        asistenciaConfirmada: { type: Boolean, default: false },

        // Cupo: 'espera' = lista de espera (no aparta lugar). Desde la app siempre es 'confirmada'.
        estadoCupo: { type: String, enum: ['confirmada', 'espera'], default: 'confirmada' },
        origen: { type: String, enum: ['recepcion', 'app'], default: 'app' },

        // Cobro (el pago en sí lo registra el módulo de cobro en recepción)
        precio: { type: Number, default: 0 },
        estadoPago: { type: String, enum: ['pendiente', 'pagado'], default: 'pendiente' },
        fechaPago: { type: Date, default: null },
        metodoPago: { type: String, default: '' },
        folioPago: { type: String, default: '' },
        pagoTipo: { type: String, enum: ['paquete', 'recepcion'], default: 'recepcion' },
        // Mismo valor que `precio` (lo usa la vista de la app)
        monto: { type: Number, default: 0 },
        membresiaCompraId: { type: String, default: '' },

        reagendada: { type: Boolean, default: false },
        reagendadaDesde: { type: origenSchema, default: null },
        fechaReagendacion: { type: Date, default: null },
        fechaCancelacion: { type: Date, default: null },
        fechaCreacion: { type: Date, default: Date.now, immutable: true },
    }
);

reservacionSchema.index({ idHorario: 1, estatus: 1, estadoCupo: 1 });
reservacionSchema.index({ idCliente: 1 });
reservacionSchema.index({ codigo: 1 }, { unique: true, partialFilterExpression: { codigo: { $type: 'string' } } });

export const Reservacion = model('Reservacion', reservacionSchema, 'webadministrativa_reservaciones');
