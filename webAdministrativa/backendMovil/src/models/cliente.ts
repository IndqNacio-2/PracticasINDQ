import { Schema, model } from 'mongoose';
import { fechaLocal } from '../lib/fecha';

// Misma colección que usa la web administrativa (webadministrativa_clientes).
// Los campos marcados como NUEVO los agrega esta API; la web administrativa los ignora
// mientras no se agreguen también a su modelo (ver README).
const membresiaSchema = new Schema(
    {
        idMembresia: { type: String, required: true },
        tipo: { type: String, enum: ['mensual', 'trimestral', 'semestral', 'anual'], required: true },
        fechaInicio: { type: String, required: true },
        fechaFin: { type: String, required: true },
        precio: { type: Number, required: true },
        estatus: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
        // NUEVO: paquete de clases ("Pilates · 12 clases")
        claseIncluida: { type: String },
        clasesTotal: { type: Number },
        clasesUsadas: { type: Number, default: 0 },
    },
    { _id: false }
);

const clienteSchema = new Schema(
    {
        nombre: { type: String, required: true },
        apellidos: { type: String, required: true },
        correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
        telefono: { type: String, default: '' },
        codigoAcceso: { type: String, required: true, unique: true },
        estatus: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
        rol: { type: String, default: 'cliente' },
        // Foto de perfil como data URL (base64)
        avatar: String,
        fechaNacimiento: String,
        direccion: String,
        fechaRegistro: { type: String, default: () => fechaLocal() },
        membresia: { type: membresiaSchema, default: null },
        // NUEVO: contraseña de la app (nunca se devuelve ni se carga por defecto)
        passwordHash: { type: String, select: false },
        // La web administrativa lo llama fechaCreacion (timestamps)
        fechaCreacion: { type: Date, default: Date.now },
    }
);

export const Cliente = model('Cliente', clienteSchema, 'webadministrativa_clientes');
