import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { Membresia } from '../models/Membresia/membresia.model';
import { requireAuth, requireRole } from '../middleware/auth';
import { claveNombre, validarMembresia } from '../lib/membresia.lib';

const router = Router();

// Siempre valida el token antes de revisar el rol
router.use(requireAuth);

const lectura = requireRole('administrador', 'recepcion');
const escritura = requireRole('administrador');

// ¿Ya existe otra membresía con ese nombre?
async function nombreRepetido(nombre: string, excluirId?: string) {
    return !!(await Membresia.exists({
        nombreClave: claveNombre(nombre),
        ...(excluirId ? { _id: { $ne: excluirId } } : {}),
    }));
}

// GET /api/membresias?estatus=activo
router.get('/', lectura, async (req, res) => {
    const filtro: Record<string, unknown> = {};
    if (req.query.estatus === 'activo' || req.query.estatus === 'inactivo') filtro.estatus = req.query.estatus;
    res.json(await Membresia.find(filtro).sort({ fechaCreacion: 1, nombre: 1 }));
});

// GET /api/membresias/:id
router.get('/:id', lectura, async (req, res) => {
    const id = String(req.params.id);
    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Id inválido' });
    const m = await Membresia.findById(id);
    if (!m) return res.status(404).json({ message: 'Membresía no encontrada' });
    res.json(m);
});

// POST /api/membresias
router.post('/', escritura, async (req, res) => {
    const r = validarMembresia(req.body);
    if (!r.ok) return res.status(400).json({ message: r.error });
    if (await nombreRepetido(r.valor.nombre)) {
        return res.status(409).json({ message: 'Ya existe una membresía con ese nombre' });
    }
    const m = await Membresia.create({ ...r.valor, nombreClave: claveNombre(r.valor.nombre) });
    res.status(201).json(m);
});

// PATCH /api/membresias/:id
// Acepta cambios parciales (por ejemplo solo { estatus }): se combinan con lo guardado y se valida todo.
// La baja es lógica: la membresía no se borra, solo pasa a "inactivo".
router.patch('/:id', escritura, async (req, res) => {
    const id = String(req.params.id);
    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Id inválido' });
    const actual = await Membresia.findById(id);
    if (!actual) return res.status(404).json({ message: 'Membresía no encontrada' });

    const combinado = { ...actual.toJSON(), ...(req.body ?? {}) };
    const r = validarMembresia(combinado);
    if (!r.ok) return res.status(400).json({ message: r.error });
    if (await nombreRepetido(r.valor.nombre, id)) {
        return res.status(409).json({ message: 'Ya existe una membresía con ese nombre' });
    }

    actual.set({ ...r.valor, nombreClave: claveNombre(r.valor.nombre) });
    await actual.save();
    res.json(actual);
});

export default router;