import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { Usuario } from '../models/Usuarios/usuarios';
import { pool } from '../lib/post';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler, manejarErrores } from '../lib/asynchandler';
import { COLUMNAS_PRODUCTO, aProducto, asegurarInventario } from '../lib/inventario';

const router = Router();
router.use(requireAuth);
// Administrador y vendedor trabajan sobre el mismo inventario.
const acceso = requireRole('administrador', 'vendedor');

const TIPOS = ['entrada', 'salida', 'merma'] as const;

// Nombre de quien registró: ventas y mermas guardan el id del usuario (MongoDB).
async function nombresDeUsuarios(valores: string[]): Promise<Map<string, string>> {
    const ids = [...new Set(valores.filter((v) => isValidObjectId(v)))];
    if (!ids.length) return new Map();
    const usuarios: any[] = await Usuario.find({ _id: { $in: ids } }).select('nombre apellidos').lean();
    return new Map(usuarios.map((u) => [String(u._id), `${u.nombre} ${u.apellidos}`.trim()]));
}

const aMovimiento = (r: any, nombres: Map<string, string> = new Map()) => ({
    id: String(r.id),
    idProducto: r.product_id === null || r.product_id === undefined ? null : String(r.product_id),
    nombreProducto: r.nombre,
    categoria: r.categoria ?? '',
    tipo: r.type, // entrada | salida | merma
    origen: r.origen ?? 'movimiento', // movimiento | venta | merma
    cantidad: Number(r.quantity),
    fecha: new Date(r.created_at).toISOString().slice(0, 10),
    fechaHora: new Date(r.created_at).toISOString(),
    motivo: r.reason ?? '',
    precioUnitario: r.unit_price === null || r.unit_price === undefined ? null : Number(r.unit_price),
    registro: nombres.get(String(r.registered_by ?? '')) ?? (isValidObjectId(String(r.registered_by ?? '')) ? '' : String(r.registered_by ?? '')),
});

// GET /api/movimientos?limit=20&desde=AAAA-MM-DD
// Historial unificado: movimientos manuales + ventas del punto de venta + mermas, del más reciente al más antiguo.
// registered_by / seller_id se leen con to_jsonb para no fallar si la columna aún no existe.
router.get('/', acceso, asyncHandler(async (req, res) => {
    await asegurarInventario();
    const pedido = Number(req.query.limit);
    const limit = Number.isInteger(pedido) && pedido > 0 ? Math.min(pedido, 2000) : 20;
    const desde = typeof req.query.desde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.desde) ? req.query.desde : '1970-01-01';
    const r = await pool.query(
        `SELECT * FROM (
            SELECT 'm' || m.id AS id, m.product_id, p.name AS nombre, p.category AS categoria, m.type, 'movimiento' AS origen,
                   m.quantity, m.reason, m.created_at, (to_jsonb(m) ->> 'registered_by') AS registered_by, NULL::numeric AS unit_price
              FROM webpontoventa.inventory_movements m JOIN webpontoventa.products p ON p.id = m.product_id
            UNION ALL
            SELECT 'v' || i.id, i.product_id, COALESCE(p.name, i.product_name), COALESCE(p.category, ''), 'salida', 'venta',
                   i.quantity, 'Venta en punto de venta · ' || s.folio, s.sold_at, (to_jsonb(s) ->> 'seller_id'), i.unit_price
              FROM webpontoventa.sale_items i JOIN webpontoventa.sales s ON s.id = i.sale_id
              LEFT JOIN webpontoventa.products p ON p.id = i.product_id
             WHERE s.status = 'completed'
            UNION ALL
            SELECT 'w' || w.id, w.product_id, p.name, p.category, 'merma', 'merma',
                   w.quantity, TRIM(w.reason || CASE WHEN COALESCE(w.observations, '') <> '' THEN ' · ' || w.observations ELSE '' END), w.created_at,
                   (to_jsonb(w) ->> 'registered_by'), NULL
              FROM webpontoventa.waste_records w JOIN webpontoventa.products p ON p.id = w.product_id
         ) t
         WHERE t.created_at >= $2::date
         ORDER BY t.created_at DESC, t.id DESC LIMIT $1`, [limit, desde]);
    const nombres = await nombresDeUsuarios(r.rows.map((x: any) => String(x.registered_by ?? '')));
    res.json(r.rows.map((x: any) => aMovimiento(x, nombres)));
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
