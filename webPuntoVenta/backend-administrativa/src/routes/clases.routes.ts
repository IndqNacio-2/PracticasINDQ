import { Router } from 'express';
import { Clase } from '../models/Clases/clases';

const router = Router();

// GET /api/clases
router.get('/', async (_req, res) => {
    const clases = await Clase.find().sort({ nombre: 1 });
    res.json(clases);
});

// POST /api/clases
router.post('/', async (req, res) => {
    const { nombre, capacidad } = req.body;
    if (!nombre || !capacidad) {
        return res.status(400).json({ error: 'Nombre y capacidad son obligatorios' });
    }

    const nueva = await Clase.create(req.body);
    res.status(201).json(nueva);
});

// PATCH /api/clases/:id  (editar y también togglear estatus)
router.patch('/:id', async (req, res) => {
    const clase = await Clase.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });
    res.json(clase);
});

export default router;