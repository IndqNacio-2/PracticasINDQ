import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { Venta } from '../models/Ventas/ventas';
import { Producto } from '../models/Productos/productos';

const router = Router();

const METODOS = ['efectivo', 'tarjeta', 'transferencia'] as const;

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

    const ventas = await Venta.find(filtro).sort({ fecha: -1, hora: -1 });
    res.json(ventas);
});

// POST /api/ventas  { nombreCliente, idCliente?, metodoPago?, productos: [{ idProducto, cantidad }] }
// Los precios, nombres y categorías salen del catálogo y el total lo calcula el servidor:
// lo que mande el frontend en esos campos se ignora.
router.post('/', async (req, res) => {
    const { nombreCliente, idCliente, metodoPago, productos } = req.body ?? {};

    if (!nombreCliente || !Array.isArray(productos) || productos.length === 0) {
        return res.status(400).json({ error: 'Cliente y al menos un producto son obligatorios' });
    }
    if (metodoPago !== undefined && !METODOS.includes(metodoPago)) {
        return res.status(400).json({ error: 'Método de pago inválido' });
    }

    const items = [];
    for (const p of productos) {
        const cantidad = Number(p?.cantidad);
        if (!isValidObjectId(p?.idProducto) || !Number.isInteger(cantidad) || cantidad < 1) {
            return res.status(400).json({ error: 'Cada producto necesita un idProducto válido y una cantidad entera mayor a 0' });
        }
        const producto = await Producto.findById(p.idProducto);
        if (!producto || producto.estatus !== 'activo') {
            return res.status(404).json({ error: 'Producto no encontrado o inactivo' });
        }
        items.push({
            idProducto: String(producto._id),
            nombre: producto.nombre,
            categoria: producto.categoria,
            cantidad,
            precio: producto.precio,
        });
    }

    const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

    const nueva = await Venta.create({
        idCliente: idCliente ? String(idCliente) : null,
        nombreCliente,
        total,
        metodoPago: metodoPago ?? 'efectivo',
        productos: items,
        recepcionistaId: String(req.auth!.id),
    });
    res.status(201).json(nueva);
});

export default router;
