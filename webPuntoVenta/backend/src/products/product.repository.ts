/**
 * Aqui vive todo el SQL de productos
 *
 * separo las consultas de las rutas para que si manana cambia la tabla,
 * solo toque este archivo y no toda la API
 */

import { postgresPool } from "../config/postgres.js";
import type { Product, ProductInput } from "./product.types.js";

// Columnas que siempre pido con los mismos alias en camelCase,
// para que la respuesta salga lista para el frontend.
const PRODUCT_COLUMNS = `
  id, code, name, description, category,
  price::float AS price, cost::float AS cost,
  stock, minimum_stock AS "minimumStock",
  status, icon, bg_color AS "bgColor"
`;

/**
 * Convierto el registro que devuelve pg en el tipo Product
 *
 * pg me manda NUMERIC como texto, por eso uso ::float en las columnas
 * de dinero y aqui fuerzo el tipo final.
 */
function toProduct(row: Record<string, unknown>): Product {
  return row as unknown as Product;
}

// Listo los productos ordenados por id, igual que en el Inventario.
export async function listProducts(): Promise<Product[]> {
  const result = await postgresPool.query(
    `SELECT ${PRODUCT_COLUMNS} FROM webpontoventa.products ORDER BY id`,
  );

  return result.rows.map(toProduct);
}

// Busco un producto por su id. Devuelvo null si no existe.
export async function findProductById(id: number): Promise<Product | null> {
  const result = await postgresPool.query(
    `SELECT ${PRODUCT_COLUMNS} FROM webpontoventa.products WHERE id = $1`,
    [id],
  );

  const row = result.rows[0];

  return row ? toProduct(row) : null;
}

// Crear un producto, insertando las 11 columnas y devolviendo la fila creada.
export async function insertProduct(input: ProductInput): Promise<Product> {
  const result = await postgresPool.query(
    `INSERT INTO webpontoventa.products
       (code, name, description, category, price, cost,
        stock, minimum_stock, status, icon, bg_color)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${PRODUCT_COLUMNS}`,
    [
      input.code, input.name, input.description, input.category, input.price,
      input.cost, input.stock, input.minimumStock, input.status,
      input.icon, input.bgColor,
    ],
  );

  return toProduct(result.rows[0]);
}

/**
 * Editar conservo la existencia actual: la existencia solo cambia con
 * "Agregar existencias" o con mermas, para no pisar el inventario al
 * corregir un precio o un nombre.
 */
export async function updateProduct(id: number, input: ProductInput): Promise<Product | null> {
  const result = await postgresPool.query(
    `UPDATE webpontoventa.products
        SET code = $1, name = $2, description = $3, category = $4,
            price = $5, cost = $6, status = $7, icon = $8, bg_color = $9,
            updated_at = NOW()
      WHERE id = $10
      RETURNING ${PRODUCT_COLUMNS}`,
    [
      input.code, input.name, input.description, input.category, input.price,
      input.cost, input.status, input.icon, input.bgColor, id,
    ],
  );

  const row = result.rows[0];

  return row ? toProduct(row) : null;
}

// Cambiar estado sin borrar el producto: sigue en el inventario
// pero deja de aparecer en el Punto de Venta.
export async function updateProductStatus(id: number, status: string): Promise<Product | null> {
  const result = await postgresPool.query(
    `UPDATE webpontoventa.products
        SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING ${PRODUCT_COLUMNS}`,
    [status, id],
  );

  const row = result.rows[0];

  return row ? toProduct(row) : null;
}

/*
 * Ajusto existencias con una sola consulta.
 *
 * El WHERE ... + $1 >= 0 hace que el descuento sea seguro: si dos
 * ventanas descuentan al mismo tiempo, la segunda no encuentra el
 * producto con existencia suficiente y devuelve 0 filas (null),
 * en lugar de dejar una existencia negativa.
 */
export async function adjustProductStock(id: number, change: number): Promise<Product | null> {
  const result = await postgresPool.query(
    `UPDATE webpontoventa.products
        SET stock = stock + $1, updated_at = NOW()
      WHERE id = $2 AND stock + $1 >= 0
      RETURNING ${PRODUCT_COLUMNS}`,
    [change, id],
  );

  const row = result.rows[0];

  return row ? toProduct(row) : null;
}
