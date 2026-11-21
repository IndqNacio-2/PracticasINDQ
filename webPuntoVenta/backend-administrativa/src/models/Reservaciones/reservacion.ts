import { Schema, model, InferSchemaType } from 'mongoose';

// Datos del horario original, se guardan al reagendar para conservar el historial.
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

// UNA sola definición de reservación para todos los módulos (cobro, administrativa y app móvil).
// La app móvil declara el mismo esquema en movilClientes/backendMovil/src/models/reservacion.ts:
// si cambias un campo aquí, cámbialo allá.
const reservacionSchema = new Schema(
    {
        // Folio de la reservación (ej. NU-48213). Es el que consulta el cliente en la app móvil.
        // sparse: las reservaciones anteriores a este cambio no tienen código y no chocan entre sí.
        codigo: { type: String, unique: true, sparse: true },

        // 'cliente' = persona registrada (idCliente obligatorio); 'visitante' = sin ficha, solo nombre.
        tipo: { type: String, enum: ['cliente', 'visitante'], default: 'cliente' },
        idCliente: {
            type: String,
            default: null,
            required: function (this: { tipo?: string }) { return this.tipo !== 'visitante'; },
        },
        nombreCliente: { type: String, required: true },

        idHorario: { type: String, required: true },
        clase: { type: String, required: true },
        // id de la clase del catálogo (para el saldo por clase de las membresías).
        claseId: { type: String, default: '' },
        entrenador: { type: String, default: '' },
        // Intervalo de la clase: "06:00 - 06:50".
        horaClase: { type: String, required: true },
        // Día en que se imparte la clase, "AAAA-MM-DD".
        fechaClase: { type: String, required: true },
        // Día en que se hizo la reservación, "AAAA-MM-DD".
        fechaReservacion: { type: String, default: '' },

        // no_asistio: el cliente no llegó a su clase (sin reembolso y sin reagendar).
        estatus: { type: String, enum: ['confirmada', 'pendiente', 'cancelada', 'no_asistio'], default: 'pendiente' },
        asistenciaConfirmada: { type: Boolean, default: false },

        // Cupo: 'espera' = en lista de espera (no aparta lugar hasta que se libere uno).
        estadoCupo: { type: String, enum: ['confirmada', 'espera'], default: 'confirmada' },
        origen: { type: String, enum: ['recepcion', 'app'], default: 'recepcion' },

        // Cobro. El pago en sí (folio, método, efectivo recibido, ticket) lo guarda el módulo de cobro;
        // aquí queda el estado para que lo vean todos los módulos.
        precio: { type: Number, default: 0 },
        estadoPago: { type: String, enum: ['pendiente', 'pagado'], default: 'pendiente' },
        fechaPago: { type: Date, default: null },
        metodoPago: { type: String, default: '' },
        folioPago: { type: String, default: '' },
        // 'paquete' = usó un acceso de su membresía; 'recepcion' = paga al llegar.
        pagoTipo: { type: String, enum: ['paquete', 'recepcion'], default: 'recepcion' },
        // Compra de membresía que cubre esta clase (id de webcobro.membresias_compras), si aplica.
        membresiaCompraId: { type: String, default: '' },

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
reservacionSchema.index({ idHorario: 1, estatus: 1, estadoCupo: 1 });
reservacionSchema.index({ fechaClase: 1 });

export type ReservacionDoc = InferSchemaType<typeof reservacionSchema>;
export const Reservacion = model('Reservacion', reservacionSchema, 'webadministrativa_reservaciones');
