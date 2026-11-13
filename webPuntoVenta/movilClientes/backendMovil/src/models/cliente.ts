// El modelo de cliente vive en el núcleo compartido (src/clientes-core), idéntico en la web administrativa
// y en esta API. Misma colección (webadministrativa_clientes) y mismo esquema: así nada se pierde al guardar
// desde un lado o desde el otro (edad, tokenVersion, perfiles de salud/actividad, paquete de clases...).
export { Cliente, COLECCION_CLIENTES } from '../clientes-core/cliente.model';
