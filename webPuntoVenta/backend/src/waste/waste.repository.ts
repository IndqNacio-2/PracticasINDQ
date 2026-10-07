/**
 * Aqui vive todo el SQL de mermas
 *
 * lo importante de este archivo es que el descuento de existencias y el
 * registro de la merma ocurren en una sola transaccion: si algo falla a
 * mitad del proceso, la base queda como estaba y no se pierden unidades
 * ni se guardan mermas sin descontar.
 */

import { postgresPool } from "../config/postgres.js";
import type { WasteInput, WasteRecord } from "./waste.types.js";

// Columnas que siempre pido con los mismos alias en camelCase,
// para que la respuesta salga lista para el frontend.
const WASTE_COLUMNS = `
  id, folio, product_id AS "productId", quantity, reason,
  observations, created_at AS "createdAt", registered_by AS "registeredBy"
`;

/**
 * Resultado de registrar una merma.
 *
 * Uso estos tres resultados para que la ruta pueda responder 201 cuando
 * todo sale bien, 404 cuando el producto no existe y 422 cuando ya no
 * alcanzan las existencias.
 */
export type WasteInsertResult =
  | { outcome: "created"; record: WasteRecord }
  | { outcome: "product-not-found" }
  | { outcome: "insufficient-stock"; available: number };

// Listo las mermas ordenadas por id, igual que las muestra la pantalla.
export async function listWasteRecords(): Promise<WasteRecord[]> {
  const result = await postgresPool.query(
    `SELECT ${WASTE_COLUMNS} FROM webpontoventa.waste_records ORDER BY id`,
  );

  return result.rows as WasteRecord[];
}

/**
 * Registro una merma y descuento la existencia dentro de la misma
 * transaccion.
 *
 * Bloqueo el producto con FOR UPDATE para que, si dos personas registran
 * una merma al mismo tiempo, la segunda espere a que termine la primera y
 * no se descuente dos veces la misma existencia.
 */
export async function insertWasteRecord(
  input: WasteInput,
): Promise<WasteInsertResult> {
  // Tomo una conexion del pool para poder abrir la transaccion.
  const client = await postgresPool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Busco el producto y lo bloqueo mientras dure la transaccion.
     * Guardo el costo porque la merma conserva el costo del momento,
     * para que la perdida calculada no cambie despues.
     */
    const productResult = await client.query(
      `SELECT id, name, cost::float AS cost, stock
         FROM webpontoventa.products
        WHERE id = $1
        FOR UPDATE`,
      [input.productId],
    );

    const product = productResult.rows[0] as
      | { id: number; name: string; cost: number; stock: number }
      | undefined;

    // Si el producto no existe, no hay nada que registrar.
    if (!product) {
      await client.query("ROLLBACK");
      return { outcome: "product-not-found" };
    }

    // Si la merma es mayor que la existencia, no permito dejar el
    // inventario en negativo.
    if (input.quantity > product.stock) {
      await client.query("ROLLBACK");
      return { outcome: "insufficient-stock", available: product.stock };
    }

    /*
     * Calculo el siguiente folio a partir del ultimo id registrado.
     * Uso LPAD para que el folio salga como M-000005.
     */
    const folioResult = await client.query(
      `SELECT COALESCE(MAX(id), 0) + 1 AS next_id
         FROM webpontoventa.waste_records`,
    );

    const nextId = (folioResult.rows[0] as { next_id: number }).next_id;
    const folio = `M-${String(nextId).padStart(6, "0")}`;

    // Descuento las unidades del producto.
    await client.query(
      `UPDATE webpontoventa.products
          SET stock = stock - $1, updated_at = NOW()
        WHERE id = $2`,
      [input.quantity, input.productId],
    );

    // Guardo la merma con el folio que acabo de calcular.
    const insertResult = await client.query(
      `INSERT INTO webpontoventa.waste_records
         (folio, product_id, quantity, reason, observations, unit_cost, registered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${WASTE_COLUMNS}`,
      [
        folio,
        input.productId,
        input.quantity,
        input.reason,
        input.observations,
        product.cost,
        input.registeredBy,
      ],
    );

    // Confirmo la transaccion: o se guarda todo, o no se guarda nada.
    await client.query("COMMIT");

    return {
      outcome: "created",
      record: insertResult.rows[0] as WasteRecord,
    };
  } catch (error) {
    // Si algo fallo, deshago los cambios para no dejar el inventario a medias.
    await client.query("ROLLBACK");
    throw error;
  } finally {
    // Siempre devuelvo la conexion al pool.
    client.release();
  }
}