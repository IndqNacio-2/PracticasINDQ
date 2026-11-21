import { Schema, model } from 'mongoose';

// Catálogo de membresías de la web administrativa (webadministrativa_membresias). La app solo lo LEE;
// el esquema es abierto porque quien lo define y lo edita es la web administrativa.
const catalogoSchema = new Schema({}, { strict: false });

export const CatalogoMembresia = model('CatalogoMembresia', catalogoSchema, 'webadministrativa_membresias');
