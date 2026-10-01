import { Router } from 'express';
import { Usuario } from '../models/Usuarios/usuarios';

const router = Router();

// GET /api/usuarios
router.get('/', async (_req, res) => {
    // Los clientes se gestionan en el módulo Clientes, no aquí.
    const usuarios = await Usuario.find().sort({ nombre: 1 });
    res.json(usuarios);
});

// POST /api/usuarios
router.post('/', async (req, res) => {
    const { nombre, correo, rol, codigoAcceso } = req.body;
    if (!nombre || !correo || !rol || !codigoAcceso) {
        return res.status(400).json({ error: 'Nombre, correo, código de acceso y rol son obligatorios' });
    }

    const correoDuplicado = await Usuario.findOne({ correo: correo.toLowerCase() });
    if (correoDuplicado) {
        return res.status(409).json({ error: 'Ya existe un usuario registrado con ese correo' });
    }

    const nuevo = await Usuario.create(req.body);
    res.status(201).json(nuevo);
});

// PATCH /api/usuarios/:id  (editar y también togglear estatus)
router.patch('/:id', async (req, res) => {
    if (req.body.correo) {
        const enUso = await Usuario.findOne({ correo: req.body.correo.toLowerCase(), _id: { $ne: req.params.id } });
        if (enUso) return res.status(409).json({ error: 'Ese correo ya está en uso por otro usuario' });
    }

    const usuario = await Usuario.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
});

export default router;