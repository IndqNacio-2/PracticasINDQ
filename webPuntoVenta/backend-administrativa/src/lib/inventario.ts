// Inventario compartido: administrador y vendedor usan la MISMA tabla de Postgres
// (webpontoventa.products), la misma que lee el backend de punto de venta y los reportes.
import { pool } from './post';

const COLS = `id, code, name, description, category, price::float AS price, cost::float AS cost,
  stock, minimum_stock AS "minimumStock", status, icon, bg_color AS "bgColor"`;

export const COLUMNAS_PRODUCTO = COLS;

// Convierte la fila de Postgres al formato que ya usa el front administrativo,
// conservando también los campos del punto de venta.
export function aProducto(r: any) {
    return {
        idProducto: String(r.id),
        id: r.id,
        codigo: r.code,
        nombre: r.name,
        descripcion: r.description,
        categoria: r.category,
        precio: r.price,
        costo: r.cost,
        stock: r.stock,
        stockMinimo: r.minimumStock,
        estatus: r.status === 'active' ? 'activo' : 'inactivo',
        icon: r.icon,
        bgColor: r.bgColor,
    };
}

export const aEstatusDB = (e: unknown) => (e === 'inactivo' || e === 'inactive' ? 'inactive' : 'active');

// Comprueba la migración; nunca cambia el esquema automáticamente en una petición.
export function asegurarInventario(): Promise<void> {
    return pool.query('SELECT 1 FROM webpontoventa.inventory_movements LIMIT 0').then(() => undefined);
}
