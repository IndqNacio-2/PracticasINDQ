import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Usuario } from '../models/Usuarios/usuarios';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Toda la colección de usuarios exige sesión iniciada: sin esto req.auth nunca
// se pobla y requireRole respondería 403 incluso a un administrador válido.
router.use(requireAuth);

// Solo el administrador puede crear, editar o cambiar el estatus de usuarios.
const soloAdministrador = requireRole('administrador');

// GET /api/usuarios
router.get('/', async (_req, res) => {
    // Los clientes se gestionan en el módulo Clientes, no aquí.
    const usuarios = await Usuario.find().sort({ nombre: 1 });
    res.json(usuarios);
});

// POST /api/usuarios
router.post('/', soloAdministrador, async (req, res) => {
    const { nombre, apellidos, correo, rol, codigoAcceso, password } = req.body;
    if (!nombre || !apellidos || !correo || !rol || !codigoAcceso || !password) {
        return res.status(400).json({ error: 'Nombre, apellidos, correo, código de acceso, rol y contraseña son obligatorios' });
    }

    const correoDuplicado = await Usuario.findOne({ correo: correo.toLowerCase() });
    if (correoDuplicado) {
        return res.status(409).json({ error: 'Ya existe un usuario registrado con ese correo' });
    }

    // La contraseña se guarda hasheada con bcrypt, nunca en texto plano.
    const passwordHash = bcrypt.hashSync(String(password), 10);
    const nuevo = await Usuario.create({ ...req.body, correo: correo.toLowerCase(), password: passwordHash });
    res.status(201).json(nuevo);
});

// PATCH /api/usuarios/:id  (editar, cambiar contraseña y togglear estatus)
router.patch('/:id', soloAdministrador, async (req, res) => {
    if (req.body.correo) {
        const enUso = await Usuario.findOne({ correo: req.body.correo.toLowerCase(), _id: { $ne: req.params.id } });
        if (enUso) return res.status(409).json({ error: 'Ese correo ya está en uso por otro usuario' });
    }

    // Si viene una contraseña nueva, se hashea antes de guardar. Si no viene,
    // no se toca el campo (queda la que ya tenía el usuario).
    const cambios = { ...req.body };
    if (cambios.password) {
        cambios.password = bcrypt.hashSync(String(cambios.password), 10);
    } else {
        delete cambios.password;
    }
    if (cambios.correo) cambios.correo = cambios.correo.toLowerCase();

    const usuario = await Usuario.findByIdAndUpdate(req.params.id, cambios, { new: true });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
});

export default router;