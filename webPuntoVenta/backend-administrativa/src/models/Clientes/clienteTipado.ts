import type { HydratedDocument, Model } from 'mongoose';
import { Cliente } from './cliente';

// Versión tipada de forma explícita del modelo Cliente.
// El esquema se infiere con una firma `[x: string]: NativeDate` que rompe los tipos de
// password, tokenVersion, _id, correo, etc. Mientras se arregla el esquema, todo el código
// de rutas y middleware usa estos dos exports en lugar de `Cliente` directamente.
export const ClienteModel = Cliente as unknown as Model<any>;
export type ClienteDocumento = HydratedDocument<any>;