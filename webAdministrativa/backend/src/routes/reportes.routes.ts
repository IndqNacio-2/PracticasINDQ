import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import { rolApiADb } from '../lib/usuarios';
import {
    reporteAsistenciaClases,
    reporteInventario,
    reportePersonal,
    reporteVentas,
    reporteVisitas,
    type Rango,
} from '../models/reportes/reportes';

const router = Router();

// Los reportes son solo para administrador
router.use(requireRole('administrador'));

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD 
function rangoDe(query: Record<string, unknown>): Rango | null {
    const { desde, hasta } = query;
    if (desde !== undefined && (typeof desde !== 'string' || (desde !== '' && !FECHA.test(desde)))) return null;
    if (hasta !== undefined && (typeof hasta !== 'string' || (hasta !== '' && !FECHA.test(hasta)))) return null;
    return {
        desde: typeof desde === 'string' && desde ? desde : undefined,
        hasta: typeof hasta === 'string' && hasta ? hasta : undefined,
    };
}

const FECHA_INVALIDA = { error: 'Las fechas deben tener formato YYYY-MM-DD' };

// GET /api/reportes/ventas  → resumen, por día, por horario, por categoría, productos por precio
router.get('/ventas', async (req, res) => {
    const rango = rangoDe(req.query);
    if (!rango) return res.status(400).json(FECHA_INVALIDA);
    res.json(await reporteVentas(rango));
});

// GET /api/reportes/visitas
router.get('/visitas', async (req, res) => {
    const rango = rangoDe(req.query);
    if (!rango) return res.status(400).json(FECHA_INVALIDA);
    res.json(await reporteVisitas(rango));
});

// GET /api/reportes/asistencia-clases?por=clase|entrenador
router.get('/asistencia-clases', async (req, res) => {
    const rango = rangoDe(req.query);
    if (!rango) return res.status(400).json(FECHA_INVALIDA);
    const por = req.query.por === 'entrenador' ? 'entrenador' : 'clase';
    res.json(await reporteAsistenciaClases(rango, por));
});

// GET /api/reportes/inventario  (el rango solo filtra las mermas)
router.get('/inventario', async (req, res) => {
    const rango = rangoDe(req.query);
    if (!rango) return res.status(400).json(FECHA_INVALIDA);
    res.json(await reporteInventario(rango));
});

// GET /api/reportes/personal  → asistencia, ausentismo y retardo
router.get('/personal', async (req, res) => {
    const rango = rangoDe(req.query);
    if (!rango) return res.status(400).json(FECHA_INVALIDA);
    res.json(await reportePersonal(rango));
});

export default router;
