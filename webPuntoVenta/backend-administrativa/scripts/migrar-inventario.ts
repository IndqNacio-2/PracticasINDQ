import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

// Misma precedencia de configuración que el gateway unificado.
config({ path: fileURLToPath(new URL('../../backend/.env', import.meta.url)) });
config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const { pool } = await import('../src/lib/post');
const conexion = await pool.connect();
try {
    await conexion.query('BEGIN');
    await conexion.query("SET LOCAL lock_timeout = '5s'");
    const existe = await conexion.query("SELECT to_regclass('webpontoventa.products') AS productos");
    if (!existe.rows[0].productos) throw new Error('No existe la tabla de productos del POS. Revisa la conexión; no se modificó el esquema.');
    const antes = await conexion.query('SELECT count(*)::int AS total FROM webpontoventa.products');
    const sql = await readFile(new URL('./inventario-compartido.sql', import.meta.url), 'utf8');
    await conexion.query(sql);
    const despues = await conexion.query('SELECT count(*)::int AS total FROM webpontoventa.products');
    if (antes.rows[0].total !== despues.rows[0].total) throw new Error('Cambió el número de productos durante la migración.');
    await conexion.query('SELECT id, product_id, type, quantity, reason, created_at FROM webpontoventa.inventory_movements LIMIT 0');
    await conexion.query('COMMIT');
    console.log(`Historial de inventario disponible. Productos conservados: ${despues.rows[0].total}.`);
} catch (error) {
    await conexion.query('ROLLBACK');
    console.error('No se completó la migración:', error);
    process.exitCode = 1;
} finally {
    conexion.release();
    await pool.end();
}