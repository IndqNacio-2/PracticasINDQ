import { Router } from 'express';
import { Cliente } from '../models/Clientes/cliente';

const router = Router();

function siguienteCodigoAcceso(total: number): string {
    return `CLI${String(total + 1).padStart(3, '0')}`;
}

router.get('/', async (_req, res) => {
    const clientes = await Cliente.find().sort({ fechaRegistro: -1 });
    res.json(clientes);
});

router.get('/:id', async (req, res) => {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
});

router.post('/', async (req, res) => {
    const { nombre, correo } = req.body;
    if (!nombre || !correo) {
        return res.status(400).json({ error: 'Nombre y correo son obligatorios' });
    }

    const existente = await Cliente.findOne({ correo: correo.toLowerCase() });
    if (existente) {
        return res.status(409).json({ error: 'Ya existe un cliente registrado con ese correo' });
    }

    const total = await Cliente.countDocuments();
    const nuevo = await Cliente.create({
        ...req.body,
        codigoAcceso: siguienteCodigoAcceso(total),
        rol: 'cliente',
    });

    res.status(201).json(nuevo);
});

router.patch('/:id', async (req, res) => {
    if (req.body.correo) {
        const enUso = await Cliente.findOne({ correo: req.body.correo.toLowerCase(), _id: { $ne: req.params.id } });
        if (enUso) return res.status(409).json({ error: 'Ese correo ya está en uso por otro cliente' });
    }

    const cliente = await Cliente.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
});

router.patch('/:id/salud', async (req, res) => {
    const cliente = await Cliente.findByIdAndUpdate(req.params.id, { perfilSalud: req.body }, { new: true });
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
});

router.patch('/:id/actividad', async (req, res) => {
    const cliente = await Cliente.findByIdAndUpdate(req.params.id, { perfilActividad: req.body }, { new: true });
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
});

router.patch('/:id/membresia', async (req, res) => {
    const cliente = await Cliente.findByIdAndUpdate(req.params.id, { membresia: req.body }, { new: true });
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
});

router.delete('/:id', async (req, res) => {
    const eliminado = await Cliente.findByIdAndDelete(req.params.id);
    if (!eliminado) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.status(204).send();
});

export default router;