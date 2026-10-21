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
    folio,
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
export async function listCashClosings(): Promise<CashClosingRecord[]> {
  const result = await postgresPool.query(
    `${CLOSING_SELECT} ORDER BY closed_at DESC, id DESC`,
  );

  return result.rows as CashClosingRecord[];
}

// Registro un corte nuevo y devuelvo la fila creada.
export async function insertCashClosing(
  input: CashClosingInput,
): Promise<CashClosingRecord> {
  /*
   * Calculo el siguiente folio a partir del ultimo id registrado.
   * Uso LPAD para que el folio salga como C-000001.
   */
  const folioResult = await postgresPool.query(
    `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM webpontoventa.cash_closings`,
  );

  const nextId = (folioResult.rows[0] as { next_id: number }).next_id;
  const folio = `C-${String(nextId).padStart(6, "0")}`;

  const insertResult = await postgresPool.query(
    `INSERT INTO webpontoventa.cash_closings
       (folio, sales_count, total_sales, cash_sales, card_sales,
        transfer_sales, initial_fund, expected_cash, counted_cash,
        difference, registered_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      folio,
      input.salesCount,
      input.totalSales,
      input.cashSales,
      input.cardSales,
      input.transferSales,
      input.initialFund,
      input.expectedCash,
      input.countedCash,
      input.difference,
      input.registeredBy,
    ],
  );

  const id = (insertResult.rows[0] as { id: number }).id;

  // Vuelvo a leer el corte para devolverlo con la fecha ya formateada.
  const savedResult = await postgresPool.query(
    `${CLOSING_SELECT} WHERE id = $1`,
    [id],
  );

  return savedResult.rows[0] as CashClosingRecord;
}