/**
 * Categorias que se muestran como filtros en el punto de venta.
 *
 * Dejo aqui solamente esta lista: los productos y las mermas que antes
 * se guardaban en este archivo ya viven en PostgreSQL y las pantallas
 * los cargan desde la API (src/services/api.ts) al abrir la aplicacion.
 */
export const CATEGORIES = ['Todos', 'Bebidas', 'Suplementos', 'Botanas', 'Ropa', 'Accesorios'];