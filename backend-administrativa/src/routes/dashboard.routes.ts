import { Router } from 'express';
import { pool } from '../lib/post';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler, manejarErrores } from '../lib/asynchandler';

// Ingresos del panel administrativo: ventas del punto de venta (webpontoventa.sales) y cobros de
// recepción, clases y membresías (webcobro.pagos). Solo administrador.
const router = Router();
router.use(requireAuth, requireRole('administrador'));

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ZONA = process.env.REPORTES_TZ || 'America/Mexico_City';

// GET /api/dashboard/ingresos?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
router.get('/ingresos', asyncHandler(async (req, res) => {
    const { desde, hasta } = req.query;
    if (typeof desde !== 'string' || typeof hasta !== 'string' || !FECHA.test(desde) || !FECHA.test(hasta)) {
        return res.status(400).json({ error: 'Las fechas "desde" y "hasta" deben tener el formato AAAA-MM-DD' });
    }
    const ventas = await pool.query(
        `SELECT 'POS-' || id AS id, to_char((sold_at AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS fecha, total::float8 AS total
           FROM webpontoventa.sales
          WHERE status = 'completed' AND (sold_at AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date`,
        [ZONA, desde, hasta],
    );
    let cobros: { rows: any[] } = { rows: [] };
    try {
        cobros = await pool.query(
            `SELECT 'COB-' || id AS id, to_char((creado_en AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS fecha, monto::float8 AS total
               FROM webcobro.pagos
              WHERE (creado_en AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date`,
            [ZONA, desde, hasta],
        );
    } catch (error) {
        console.warn('[dashboard] No se pudieron leer los cobros de recepción:', (error as Error).message);
    }
    res.json([
        ...ventas.rows.map((v) => ({ ...v, origen: 'punto_de_venta' })),
        ...cobros.rows.map((c) => ({ ...c, origen: 'cobro' })),
    ].sort((a, b) => b.fecha.localeCompare(a.fecha)));
}));

router.use(manejarErrores);
export default router;
