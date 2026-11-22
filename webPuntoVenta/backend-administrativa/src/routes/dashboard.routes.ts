import { Router } from 'express';
import { asyncHandler, manejarErrores } from '../lib/asynchandler';
import { ingresosDelPeriodo } from '../services/dashboard.service';

// Datos del panel administrativo (solo administrador: ver middleware/permisos.ts).
const router = Router();

// GET /api/dashboard/ingresos?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
// Ventas del punto de venta + cobros de recepción del periodo.
router.get('/ingresos', asyncHandler(async (req, res) => {
    try {
        res.json(await ingresosDelPeriodo(req.query.desde, req.query.hasta));
    } catch (error: any) {
        if (error?.status === 400) return res.status(400).json({ error: error.message });
        throw error;
    }
}));

router.use(manejarErrores);

export default router;