import { Router } from 'express';
import { Movimiento } from '../models/Movimientos/movimientos';
import { Producto } from '../models/Productos/productos';

const router = Router();

// GET /api/movimientos?limit=6
router.get('/', async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    // Orden por _id descendente = orden real de inserción (el ObjectId trae timestamp),
    // más confiable que ordenar por "fecha" cuando varios movimientos caen el mismo día.
    const movimientos = await Movimiento.find().sort({ _id: -1 }).limit(limit);
    res.json(movimientos);
});

// POST /api/movimientos
// Crea el movimiento y ajusta el stock del producto correspondiente.
router.post('/', async (req, res) => {
    const { idProducto, tipo, cantidad } = req.body;
    if (!idProducto || !tipo || !cantidad) {
        return res.status(400).json({ error: 'Producto, tipo y cantidad son obligatorios' });
    }

    const producto = await Producto.findById(idProducto);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const delta = tipo === 'entrada' ? Number(cantidad) : -Number(cantidad);
    producto.stock = Math.max(0, producto.stock + delta);
    await producto.save();

    const nuevo = await Movimiento.create({
        idProducto,
        nombreProducto: producto.nombre,
        tipo,
        cantidad: Number(cantidad),
        motivo: req.body.motivo ?? '',
    });

    // Devolvemos ambos: el movimiento creado y el producto ya con el stock actualizado,
    // para que el front no tenga que hacer un segundo fetch.
    res.status(201).json({ movimiento: nuevo, producto });
});

export default router;