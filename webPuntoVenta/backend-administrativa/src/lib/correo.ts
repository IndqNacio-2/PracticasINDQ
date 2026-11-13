import { createRequire } from 'node:module';
// Una misma regla para el catálogo histórico y los clientes de Recepción.
export const { esCorreoValido } = createRequire(import.meta.url)('../../../backend-cobro/validacionCliente.js') as {
    esCorreoValido: (valor: unknown, obligatorio?: boolean) => boolean;
};