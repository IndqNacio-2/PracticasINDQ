import { Router } from 'express';
import { Movimiento } from '../models/Movimientos/movimientos';
import { Producto } from '../models/Productos/productos';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler, manejarErrores } from '../lib/asynchandler';

const router = Router();

// Todas las rutas de inventario requieren sesión iniciada.
router.use(requireAuth);

// Solo el administrador puede registrar movimientos (ajusta los roles a tus reglas).
const escritura = requireRole('administrador');

const TIPOS = ['entrada', 'salida', 'merma'] as const;
type TipoMovimiento = (typeof TIPOS)[number];

// GET /api/movimientos?limit=6
router.get('/', asyncHandler(async (req, res) => {
    // Se limita el valor para evitar límites inválidos (NaN, negativos) o consultas enormes.
    const pedido = Number(req.query.limit);
    const limit = Number.isInteger(pedido) && pedido > 0 ? Math.min(pedido, 100) : 20;

    // Orden por _id descendente = orden real de inserción (el ObjectId trae timestamp),
    // más confiable que ordenar por "fecha" cuando varios movimientos caen el mismo día.
    const movimientos = await Movimiento.find().sort({ _id: -1 }).limit(limit);
    res.json(movimientos);
}));

// POST /api/movimientos
// Ajusta el stock del producto y registra el movimiento.
router.post('/', escritura, asyncHandler(async (req, res) => {
    const { idProducto, tipo, motivo } = req.body;
    const cantidad = Number(req.body.cantidad);

    if (!idProducto || !TIPOS.includes(tipo) || !Number.isInteger(cantidad) || cantidad <= 0) {
        return res.status(400).json({
            error: 'Producto, tipo válido (entrada, salida o merma) y cantidad entera mayor a 0 son obligatorios',
        });
    }

    // Entrada suma; salida y merma restan.
    const delta = (tipo as TipoMovimiento) === 'entrada' ? cantidad : -cantidad;

    // Ajuste atómico: si resta, solo se aplica cuando hay stock suficiente.
    // Así dos movimientos simultáneos no se pisan ni dejan el stock en negativo.
    const producto = await Producto.findOneAndUpdate(
        { _id: idProducto, ...(delta < 0 ? { stock: { $gte: cantidad } } : {}) },
        { $inc: { stock: delta } },
        { new: true }
    );

    if (!producto) {
        // No se aplicó: puede ser que no exista o que el stock no alcance.
        const existe = await Producto.exists({ _id: idProducto });
        return res.status(existe ? 409 : 404).json({
            error: existe ? 'Stock insuficiente para este movimiento' : 'Producto no encontrado',
        });
    }

    try {
        const movimiento = await Movimiento.create({
            idProducto,
            nombreProducto: producto.nombre,
            tipo,
            cantidad,
            motivo: typeof motivo === 'string' ? motivo : '',
        });

        // Devolvemos ambos: el movimiento creado y el producto ya con el stock actualizado,
        // para que el front no tenga que hacer un segundo fetch.
        res.status(201).json({ movimiento, producto });
    } catch (err) {
        // Si no se pudo guardar el movimiento, se revierte el ajuste de stock
        // para que inventario e historial no queden desfasados.
        await Producto.updateOne({ _id: idProducto }, { $inc: { stock: -delta } });
        throw err;
    }
}));

// Manejo de errores del router (ids inválidos, validaciones de Mongoose, etc.).
router.use(manejarErrores);

export default router;