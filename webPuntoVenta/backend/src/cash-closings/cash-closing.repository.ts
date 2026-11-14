/**
 * Aqui vive todo el SQL de los cortes de caja
 *
 * un corte no modifica el inventario ni las existencias, asi que basta
 * con insertar el registro y volver a leerlo para devolverlo listo al
 * frontend.
 */

import { postgresPool } from "../config/postgres.js";
import type {
  CashClosingInput,
  CashClosingRecord,
} from "./cash-closing.types.js";

// Columnas que siempre pido con los mismos alias en camelCase.
const CLOSING_SELECT = `
  SELECT
    id,
    folio,
    closed_at AS "closedAt",
    to_char(closed_at AT TIME ZONE 'America/Mexico_City', 'DD/MM/YYYY') AS date,
    to_char(closed_at AT TIME ZONE 'America/Mexico_City', 'HH24:MI')    AS time,
    sales_count::int        AS "salesCount",
    total_sales::float      AS "totalSales",
    cash_sales::float       AS "cashSales",
    card_sales::float       AS "cardSales",
    transfer_sales::float   AS "transferSales",
    initial_fund::float     AS "initialFund",
    expected_cash::float    AS "expectedCash",
    counted_cash::float     AS "countedCash",
    difference::float       AS difference,
    registered_by           AS "registeredBy"
  FROM webpontoventa.cash_closings
`;

// Listo los cortes del mas reciente al mas antiguo.
export async function listCashClosings(sellerId: string): Promise<CashClosingRecord[]> {
  const result = await postgresPool.query(
    `${CLOSING_SELECT} WHERE seller_id = $1 ORDER BY closed_at DESC, id DESC`,
    [sellerId],
  );

  return result.rows as CashClosingRecord[];
}

// Registro un corte nuevo y devuelvo la fila creada.
export async function insertCashClosing(
  input: CashClosingInput,
  sellerId: string,
  saleIds: number[],
): Promise<CashClosingRecord> {
  const client = await postgresPool.connect();
  try {
  await client.query('BEGIN');
  /*
   * Calculo el siguiente folio a partir del ultimo id registrado.
   * Uso LPAD para que el folio salga como C-000001.
   */
  await client.query('LOCK TABLE webpontoventa.cash_closings IN EXCLUSIVE MODE');
  const ventas = await client.query(`SELECT id, total::float AS total, payment_method
    FROM webpontoventa.sales WHERE seller_id = $1 AND id = ANY($2::int[])
    AND cash_closing_id IS NULL AND status = 'completed' FOR UPDATE`, [sellerId, saleIds]);
  if (ventas.rows.length !== saleIds.length) throw new Error('Las ventas ya tienen corte o no pertenecen al usuario.');
  const suma = (method?: string): number => ventas.rows.reduce((total: number, venta: { total: number; payment_method: string }) =>
    total + (!method || venta.payment_method === method ? Number(venta.total) : 0), 0);
  const cashSales = suma('efectivo');
  const expectedCash = Math.round((cashSales + input.initialFund) * 100) / 100;
  const folioResult = await client.query(
    `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM webpontoventa.cash_closings`,
  );

  const nextId = (folioResult.rows[0] as { next_id: number }).next_id;
  const folio = `C-${String(nextId).padStart(6, "0")}`;

  const insertResult = await client.query(
    `INSERT INTO webpontoventa.cash_closings
       (folio, sales_count, total_sales, cash_sales, card_sales,
        transfer_sales, initial_fund, expected_cash, counted_cash,
        difference, registered_by, seller_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      folio,
      ventas.rows.length,
      suma(),
      cashSales,
      suma('tarjeta'),
      suma('transferencia'),
      input.initialFund,
      expectedCash,
      input.countedCash,
      Math.round((input.countedCash - expectedCash) * 100) / 100,
      input.registeredBy,
      sellerId,
    ],
  );

  const id = (insertResult.rows[0] as { id: number }).id;
  const marked = await client.query(`UPDATE webpontoventa.sales SET cash_closing_id = $1
    WHERE seller_id = $2 AND id = ANY($3::int[]) AND cash_closing_id IS NULL AND status = 'completed'`, [id, sellerId, saleIds]);
  if (marked.rowCount !== saleIds.length) throw new Error('Las ventas del corte cambiaron. Recarga e intenta nuevamente.');

  // Vuelvo a leer el corte para devolverlo con la fecha ya formateada.
  const savedResult = await client.query(
    `${CLOSING_SELECT} WHERE id = $1`,
    [id],
  );

  await client.query('COMMIT');
  return savedResult.rows[0] as CashClosingRecord;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}