import { Router } from 'express';
import { Producto } from '../models/Productos/productos';

const router = Router();

// GET /api/productos
router.get('/', async (_req, res) => {
    const productos = await Producto.find().sort({ nombre: 1 });
    res.json(productos);
});

// POST /api/productos
router.post('/', async (req, res) => {
    const { nombre, precio, categoria } = req.body;
    if (!nombre || precio === undefined || !categoria) {
        return res.status(400).json({ error: 'Nombre, precio y categoría son obligatorios' });
    }

    const nuevo = await Producto.create({
        ...req.body,
        stock: req.body.stock ?? 0,
    });

    res.status(201).json(nuevo);
});

// PATCH /api/productos/:id
router.patch('/:id', async (req, res) => {
    const producto = await Producto.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
});

export default router;