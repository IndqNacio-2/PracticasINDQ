/**
 * Aqui vive todo el SQL de ventas
 *
 * lo importante de este archivo es que el encabezado de la venta, sus
 * articulos y el descuento de existencias ocurren en una sola
 * transaccion: si algo falla a mitad del proceso, la base queda como
 * estaba y no se guarda una venta a medias.
 */

import { postgresPool } from "../config/postgres.js";
import type { SaleInput, SaleRecord } from "./sale.types.js";

/**
 * Armo la venta completa en una sola consulta.
 *
 * Con json_agg junto los articulos de cada venta en un arreglo, asi el
 * frontend recibe exactamente la forma que ya usa (items con name, qty,
 * unitPrice y subtotal) sin tener que unir nada.
 *
 * Formateo la fecha y la hora en la zona horaria de Mexico y no en la del
 * servidor, para que el ticket muestre la misma hora a la que se cobro.
 */
const SALE_SELECT = `
  SELECT
    s.folio,
    to_char(s.sold_at AT TIME ZONE 'America/Mexico_City', 'DD/MM/YYYY') AS date,
    to_char(s.sold_at AT TIME ZONE 'America/Mexico_City', 'HH24:MI')    AS time,
    s.subtotal::float      AS subtotal,
    s.discount::float      AS discount,
    s.total::float         AS total,
    s.payment_method       AS "paymentMethod",
    s.cash_received::float AS "cashReceived",
    s.change_amount::float AS "change",
    s.transfer_ref         AS "transferRef",
    COALESCE(
      (
        SELECT json_agg(
                 json_build_object(
                   'name',      i.product_name,
                   'qty',       i.quantity,
                   'unitPrice', i.unit_price::float,
                   'subtotal',  i.line_total::float
                 )
                 ORDER BY i.id
               )
          FROM webpontoventa.sale_items i
         WHERE i.sale_id = s.id
      ),
      '[]'::json
    ) AS items
  FROM webpontoventa.sales s
`;

/**
 * Resultado de registrar una venta.
 *
 * Uso estos tres resultados para que la ruta pueda responder 201 cuando
 * todo sale bien, 404 cuando un producto no existe y 422 cuando ya no
 * alcanzan las existencias.
 */
export type SaleInsertResult =
  | { outcome: "created"; sale: SaleRecord }
  | { outcome: "product-not-found"; productId: number }
  | { outcome: "insufficient-stock"; productName: string; available: number };

/**
 * Registro una venta completa dentro de una sola transaccion.
 *
 * El orden es importante:
 *   1. bloqueo cada producto y reviso que alcance la existencia,
 *   2. calculo el folio, el subtotal y el total con los precios del
 *      catalogo (no con los que manda el navegador),
 *   3. guardo el encabezado y sus articulos,
 *   4. descuento las existencias,
 *   5. confirmo la transaccion.
 *
 * Si cualquier paso falla, deshago todo con ROLLBACK.
 */
export async function insertSale(input: SaleInput): Promise<SaleInsertResult> {
  // Tomo una conexion del pool para poder abrir la transaccion.
  const client = await postgresPool.connect();

  try {
    await client.query("BEGIN");

    // Aqui junto los renglones del ticket ya con el nombre y el precio
    // que tiene el producto en este momento.
    const items: Array<{
      productId: number;
      name: string;
      qty: number;
      unitPrice: number;
      subtotal: number;
    }> = [];

    for (const item of input.items) {
      /*
       * Bloqueo el producto mientras dure la transaccion para que, si dos
       * cajas venden al mismo tiempo, la segunda espere y no se venda dos
       * veces la misma existencia.
       */
      const productResult = await client.query(
        `SELECT id, name, price::float AS price, stock
           FROM webpontoventa.products
          WHERE id = $1
          FOR UPDATE`,
        [item.productId],
      );

      const product = productResult.rows[0] as
        | { id: number; name: string; price: number; stock: number }
        | undefined;

      // El producto pudo borrarse del catalogo entre que se armo el
      // carrito y se cobro: no se puede vender.
      if (!product) {
        await client.query("ROLLBACK");
        return { outcome: "product-not-found", productId: item.productId };
      }

      // No permito vender mas unidades de las que hay.
      if (item.quantity > product.stock) {
        await client.query("ROLLBACK");
        return {
          outcome: "insufficient-stock",
          productName: product.name,
          available: product.stock,
        };
      }

      items.push({
        productId: product.id,
        name: product.name,
        qty: item.quantity,
        unitPrice: product.price,
        subtotal: product.price * item.quantity,
      });
    }

    // Calculo los importes de la venta.
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

    // El descuento nunca puede ser mayor que el subtotal, porque el total
    // no puede quedar negativo.
    const discount = Math.min(input.discount, subtotal);
    const total = subtotal - discount;

    // El cambio solo existe cuando se paga en efectivo de mas.
    const change =
      input.cashReceived !== undefined
        ? Math.max(input.cashReceived - total, 0)
        : undefined;

    /*
     * Calculo el siguiente folio a partir del ultimo id registrado.
     * Uso LPAD para que el folio salga como V-000125.
     */
    const folioResult = await client.query(
      `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM webpontoventa.sales`,
    );

    const nextId = (folioResult.rows[0] as { next_id: number }).next_id;
    const folio = `V-${String(nextId).padStart(6, "0")}`;

    // Guardo el encabezado de la venta.
    const saleResult = await client.query(
      `INSERT INTO webpontoventa.sales
         (folio, subtotal, discount, total, payment_method,
          cash_received, change_amount, transfer_ref, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed')
       RETURNING id`,
      [
        folio,
        subtotal,
        discount,
        total,
        input.paymentMethod,
        input.cashReceived ?? null,
        change ?? null,
        input.transferRef ?? null,
      ],
    );

    const saleId = (saleResult.rows[0] as { id: number }).id;

    // Guardo cada articulo y descuento su existencia.
    for (const item of items) {
      await client.query(
        `INSERT INTO webpontoventa.sale_items
           (sale_id, product_id, product_name, unit_price, quantity, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          saleId,
          item.productId,
          item.name,
          item.unitPrice,
          item.qty,
          item.subtotal,
        ],
      );

      await client.query(
        `UPDATE webpontoventa.products
            SET stock = stock - $1, updated_at = NOW()
          WHERE id = $2`,
        [item.qty, item.productId],
      );
    }

    // Vuelvo a leer la venta ya guardada para devolverla en el formato
    // que usa el frontend.
    const savedResult = await client.query(
      `${SALE_SELECT} WHERE s.folio = $1`,
      [folio],
    );

    // Confirmo la transaccion: o se guarda todo, o no se guarda nada.
    await client.query("COMMIT");

    return {
      outcome: "created",
      sale: savedResult.rows[0] as SaleRecord,
    };
  } catch (error) {
    // Si algo fallo, deshago los cambios para no dejar la venta a medias.
    await client.query("ROLLBACK");
    throw error;
  } finally {
    // Siempre devuelvo la conexion al pool.
    client.release();
  }
}

// Listo las ventas ordenadas por fecha, igual que las muestra el corte de caja.
export async function listSales(): Promise<SaleRecord[]> {
  const result = await postgresPool.query(
    `${SALE_SELECT} WHERE s.status = 'completed' ORDER BY s.sold_at, s.id`,
  );

  return result.rows as SaleRecord[];
}