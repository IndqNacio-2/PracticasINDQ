import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
config({ path: fileURLToPath(new URL('../../../backend-administrativa/.env', import.meta.url)) });
const { postgresPool } = await import('../config/postgres.js');
const cx = await postgresPool.connect();
try {
  await cx.query('BEGIN');
  await cx.query("SET LOCAL lock_timeout = '5s'");
  const antes = await cx.query('SELECT count(*)::int AS total FROM webpontoventa.sales');
  await cx.query(`
    ALTER TABLE webpontoventa.sales ADD COLUMN IF NOT EXISTS seller_id text;
    ALTER TABLE webpontoventa.sales ADD COLUMN IF NOT EXISTS cash_closing_id integer REFERENCES webpontoventa.cash_closings(id);
    ALTER TABLE webpontoventa.cash_closings ADD COLUMN IF NOT EXISTS seller_id text;
    CREATE INDEX IF NOT EXISTS sales_seller_idx ON webpontoventa.sales(seller_id, id);
    CREATE INDEX IF NOT EXISTS closings_seller_idx ON webpontoventa.cash_closings(seller_id);
  `);
  const despues = await cx.query('SELECT count(*)::int AS total FROM webpontoventa.sales');
  if (antes.rows[0].total !== despues.rows[0].total) throw new Error('Cambió el número de ventas');
  await cx.query('COMMIT');
  console.log(`Migración completada. Ventas conservadas: ${despues.rows[0].total}. Ventas antiguas sin atribución automática.`);
} catch (error) {
  await cx.query('ROLLBACK'); console.error(error); process.exitCode = 1;
} finally { cx.release(); await postgresPool.end(); }