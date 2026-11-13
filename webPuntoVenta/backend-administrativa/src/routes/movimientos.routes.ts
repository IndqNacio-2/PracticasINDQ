import { Router } from 'express';
import { pool } from '../lib/post';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler, manejarErrores } from '../lib/asynchandler';
import { COLUMNAS_PRODUCTO, aProducto, asegurarInventario } from '../lib/inventario';

const router = Router();
router.use(requireAuth);
// Administrador y vendedor trabajan sobre el mismo inventario.
const acceso = requireRole('administrador', 'vendedor');

const TIPOS = ['entrada', 'salida', 'merma'] as const;

const aMovimiento = (r: any) => ({
    id: String(r.id),
    idProducto: String(r.product_id),
    nombreProducto: r.nombre,
    tipo: r.type,
    cantidad: r.quantity,
    fecha: new Date(r.created_at).toISOString().slice(0, 10),
    motivo: r.reason,
});

router.get('/', acceso, asyncHandler(async (req, res) => {
    await asegurarInventario();
    const pedido = Number(req.query.limit);
    const limit = Number.isInteger(pedido) && pedido > 0 ? Math.min(pedido, 100) : 20;
    const r = await pool.query(
        `SELECT m.*, p.name AS nombre FROM webpontoventa.inventory_movements m
         JOIN webpontoventa.products p ON p.id = m.product_id ORDER BY m.id DESC LIMIT $1`, [limit]);
    res.json(r.rows.map(aMovimiento));
}));

router.post('/', acceso, asyncHandler(async (req, res) => {
    await asegurarInventario();
    const { tipo, motivo } = req.body;
    const idProducto = Number(req.body.idProducto);
    const cantidad = Number(req.body.cantidad);
    if (!Number.isInteger(idProducto) || idProducto <= 0 || !TIPOS.includes(tipo) ||
        !Number.isInteger(cantidad) || cantidad <= 0) {
        return res.status(400).json({
            error: 'Producto, tipo válido (entrada, salida o merma) y cantidad entera mayor a 0 son obligatorios',
        });
    }
    const delta = tipo === 'entrada' ? cantidad : -cantidad;

    // Ajuste de stock + historial en una transacción; el WHERE evita stock negativo.
    const cx = await pool.connect();
    try {
        await cx.query('BEGIN');
        const u = await cx.query(
            `UPDATE webpontoventa.products SET stock = stock + $1, updated_at = NOW()
             WHERE id = $2 AND stock + $1 >= 0 RETURNING ${COLUMNAS_PRODUCTO}`, [delta, idProducto]);
        if (!u.rows[0]) {
            const e = await cx.query('SELECT 1 FROM webpontoventa.products WHERE id = $1', [idProducto]);
            await cx.query('ROLLBACK');
            return res.status(e.rowCount ? 409 : 404).json({
                error: e.rowCount ? 'Stock insuficiente para este movimiento' : 'Producto no encontrado',
            });
        }
        const m = await cx.query(
            `INSERT INTO webpontoventa.inventory_movements (product_id, type, quantity, reason)
             VALUES ($1,$2,$3,$4) RETURNING *`,
            [idProducto, tipo, cantidad, typeof motivo === 'string' ? motivo.slice(0, 300) : '']);
        await cx.query('COMMIT');
        res.status(201).json({
            movimiento: aMovimiento({ ...m.rows[0], nombre: u.rows[0].name }),
            producto: aProducto(u.rows[0]),
        });
    } catch (err) {
        await cx.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        cx.release();
    }
}));

router.use(manejarErrores);
export default router;
