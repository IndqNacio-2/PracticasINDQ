import { Router } from 'express';
import { Venta } from '../models/Ventas/ventas';

const router = Router();

// GET /api/ventas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get('/', async (req, res) => {
    const { desde, hasta } = req.query;
    const filtro: Record<string, unknown> = {};
    if (desde || hasta) {
        filtro.fecha = {
            ...(desde ? { $gte: desde } : {}),
            ...(hasta ? { $lte: hasta } : {}),
        };
    }

    const ventas = await Venta.find(filtro).sort({ fecha: -1 });
    res.json(ventas);
});

// POST /api/ventas
router.post('/', async (req, res) => {
    const { nombreCliente, total, productos } = req.body;
    if (!nombreCliente || total === undefined || !productos) {
        return res.status(400).json({ error: 'Cliente, total y productos son obligatorios' });
    }

    const nueva = await Venta.create(req.body);
    res.status(201).json(nueva);
});

export default router;