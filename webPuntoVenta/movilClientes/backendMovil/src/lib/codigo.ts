import { generarCodigo, PREFIJO_MEMBRESIA, PREFIJO_RESERVACION } from '../clientes-core/codigos';

// Todos los códigos siguen PREFIJO-XXXXX (prefijo + guion + 5 dígitos); la lógica vive en clientes-core/codigos.ts.

/** Código de reservación que va dentro del QR, por ejemplo NU-48213 */
export const codigoReservacion = () => generarCodigo(PREFIJO_RESERVACION);

/** Código de una membresía/paquete apartado desde la app, por ejemplo PQ-07391 */
export const codigoMembresia = () => generarCodigo(PREFIJO_MEMBRESIA);

export { campoDuplicado } from '../clientes-core/codigos';
