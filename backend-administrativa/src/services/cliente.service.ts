// La lógica de alta y validación de clientes vive en el núcleo compartido (src/clientes-core),
// idéntico en la web administrativa y en la app móvil. Se re-exporta aquí para no cambiar los imports.
export {
    normalizarPerfil,
    errorPassword,
    registrarCliente,
    type Origen,
    type OpcionesPerfil,
    type ResultadoValidacion,
    type ResultadoRegistro,
} from '../clientes-core/cliente.core';
