// ============================================================================
// NÚCLEO COMPARTIDO DE MEMBRESÍAS  ·  compra.model.ts
// Carpeta idéntica en backend-administrativa y movilClientes/backendMovil
// (si cambias algo aquí, cópialo a la otra; `diff -r` debe salir vacío).
//
// Una compra de membresía es lo que el cliente adquiere del catálogo (webadministrativa_membresias):
//   - 'apartada': la apartó desde la app móvil. Tiene un código PQ-XXXXX y se paga al llegar al local.
//   - 'activa'  : ya está pagada y en vigencia (se pagó en recepción, o se cobró el apartado).
//   - 'cancelada': se canceló el apartado (una compra pagada no se cancela: no hay reembolso).
// El pago en sí (folio, método, efectivo, ticket) lo guarda el módulo de cobro en Postgres; aquí queda su estado
// para que lo vean todos los módulos. El saldo de entradas NO se guarda: se calcula con las reservaciones
// que apuntan a la compra (membresiaCompraId), así no hay un contador que se desincronice.
// ============================================================================
import { Schema, model } from 'mongoose';

export const COLECCION_COMPRAS_MEMBRESIA = 'webadministrativa_membresias_compras';

const compraSchema = new Schema(
    {
        // Código para pagar al llegar: PQ-XXXXX (mismo formato que los de reservación).
        codigo: { type: String },
        idCliente: { type: String, required: true },
        nombreCliente: { type: String, required: true },

        // Qué se compró del catálogo, y una copia de sus condiciones al momento de comprar
        // (si luego cambia el catálogo, esta compra conserva lo que se ofreció).
        idMembresia: { type: String, required: true },
        idOpcion: { type: String, required: true },
        condiciones: { type: Schema.Types.Mixed, required: true },

        estado: { type: String, enum: ['apartada', 'activa', 'cancelada'], default: 'apartada' },
        // Vigencia "AAAA-MM-DD". Una compra apartada no la tiene hasta que se paga.
        fechaInicio: { type: String, default: null },
        fechaFin: { type: String, default: null },

        precio: { type: Number, required: true },
        estadoPago: { type: String, enum: ['pendiente', 'pagado'], default: 'pendiente' },
        fechaPago: { type: Date, default: null },
        metodoPago: { type: String, default: '' },
        folioPago: { type: String, default: '' },

        origen: { type: String, enum: ['recepcion', 'app'], default: 'recepcion' },
        // Idempotencia de la venta en recepción: reintentar la misma solicitud no duplica la compra.
        solicitudId: { type: String },

        fechaCreacion: { type: Date, default: Date.now, immutable: true },
        fechaCancelacion: { type: Date, default: null },
    },
    {
        toJSON: {
            transform(_doc, ret: Record<string, any>) {
                ret.idCompra = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    },
);

compraSchema.index({ idCliente: 1, estado: 1 });
compraSchema.index({ codigo: 1 }, { unique: true, partialFilterExpression: { codigo: { $type: 'string' } } });
compraSchema.index({ solicitudId: 1 }, { unique: true, partialFilterExpression: { solicitudId: { $type: 'string' } } });

export const CompraMembresia = model('CompraMembresia', compraSchema, COLECCION_COMPRAS_MEMBRESIA);
