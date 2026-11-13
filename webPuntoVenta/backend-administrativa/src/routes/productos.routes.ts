import { Router } from 'express';
import { pool } from '../lib/post';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler, manejarErrores } from '../lib/asynchandler';
import { COLUMNAS_PRODUCTO, aProducto, aEstatusDB, asegurarInventario } from '../lib/inventario';

const router = Router();
router.use(requireAuth);
// Administrador y vendedor comparten el mismo inventario.
const acceso = requireRole('administrador', 'vendedor');

const T = 'webpontoventa.products';
const idValido = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
const num = (v: unknown, d = 0) => (v === undefined || v === null || v === '' ? d : Number(v));

router.get('/', acceso, asyncHandler(async (_req, res) => {
    const r = await pool.query(`SELECT ${COLUMNAS_PRODUCTO} FROM ${T} ORDER BY name`);
    res.json(r.rows.map(aProducto));
}));

router.post('/', acceso, asyncHandler(async (req, res) => {
    const b = req.body;
    const nombre = b.nombre ?? b.name, categoria = b.categoria ?? b.category;
    const precio = num(b.precio ?? b.price, NaN);
    if (!nombre || !categoria || !Number.isFinite(precio) || precio < 0) {
        return res.status(400).json({ error: 'Nombre, precio y categoría son obligatorios' });
    }
    const stock = num(b.stock), min = num(b.stockMinimo ?? b.minimumStock);
    if (!Number.isInteger(stock) || stock < 0 || !Number.isInteger(min) || min < 0) {
        return res.status(400).json({ error: 'Stock y stock mínimo deben ser enteros >= 0' });
    }
    const codigo = b.codigo ?? b.code ?? `PRD-${Date.now().toString(36).toUpperCase()}`;
    const r = await pool.query(
        `INSERT INTO ${T} (code, name, description, category, price, cost, stock, minimum_stock, status, icon, bg_color)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10,'inventory_2'),COALESCE($11,'#F3F4F6'))
         RETURNING ${COLUMNAS_PRODUCTO}`,
        [codigo, nombre, b.descripcion ?? b.description ?? '', categoria, precio, num(b.costo ?? b.cost),
         stock, min, aEstatusDB(b.estatus ?? b.status), b.icon ?? null, b.bgColor ?? null]
    );
    res.status(201).json(aProducto(r.rows[0]));
}));

router.patch('/:id', acceso, asyncHandler(async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ error: 'Id de producto inválido' });
    const b = req.body;
    // stock solo cambia por movimientos (entrada/salida/merma) o por ventas.
    const mapa: Record<string, [string, unknown]> = {
        code: ['code', b.codigo ?? b.code], name: ['name', b.nombre ?? b.name],
        description: ['description', b.descripcion ?? b.description], category: ['category', b.categoria ?? b.category],
        price: ['price', b.precio ?? b.price], cost: ['cost', b.costo ?? b.cost],
        minimum_stock: ['minimum_stock', b.stockMinimo ?? b.minimumStock],
        status: ['status', (b.estatus ?? b.status) === undefined ? undefined : aEstatusDB(b.estatus ?? b.status)],
        icon: ['icon', b.icon], bg_color: ['bg_color', b.bgColor],
    };
    const campos = Object.entries(mapa).filter(([, [, v]]) => v !== undefined);
    if (!campos.length) return res.status(400).json({ error: 'Nada que actualizar' });
    const sets = campos.map(([col], i) => `${col} = $${i + 1}`).join(', ');
    const r = await pool.query(
        `UPDATE ${T} SET ${sets}, updated_at = NOW() WHERE id = $${campos.length + 1} RETURNING ${COLUMNAS_PRODUCTO}`,
        [...campos.map(([, [, v]]) => v), id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(aProducto(r.rows[0]));
}));

router.use(manejarErrores);
export default router;
