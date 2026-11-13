import { Router } from 'express';
import { Producto } from '../models/Productos/productos';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler, manejarErrores } from '../lib/asynchandler';

const router = Router();
router.use(requireAuth);
// Ajusta los roles a tus reglas reales.
const escritura = requireRole('administrador');

const CAMPOS_EDITABLES = ['nombre', 'descripcion', 'precio', 'categoria', 'estatus'] as const;
const pick = (body: any, campos: readonly string[]) =>
    Object.fromEntries(campos.filter(c => body[c] !== undefined).map(c => [c, body[c]]));

router.get('/', asyncHandler(async (_req, res) => {
    res.json(await Producto.find().sort({ nombre: 1 }));
}));

router.post('/', escritura, asyncHandler(async (req, res) => {
    const { nombre, precio, categoria } = req.body;
    if (!nombre || precio === undefined || !categoria) {
        return res.status(400).json({ error: 'Nombre, precio y categoría son obligatorios' });
    }
    const nuevo = await Producto.create({
        ...pick(req.body, CAMPOS_EDITABLES),
        stock: req.body.stock ?? 0,
    });
    res.status(201).json(nuevo);
}));

router.patch('/:id', escritura, asyncHandler(async (req, res) => {
    const producto = await Producto.findByIdAndUpdate(
        req.params.id,
        pick(req.body, CAMPOS_EDITABLES), // stock solo cambia por movimientos
        { new: true, runValidators: true }
    );
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
}));

router.use(manejarErrores);
export default router;