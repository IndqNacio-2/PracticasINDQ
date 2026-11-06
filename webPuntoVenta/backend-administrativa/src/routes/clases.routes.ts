// clases.routes.ts
import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ClienteModel as Cliente } from '../models/Clientes/clienteTipado';
import { asyncHandler, manejarErrores } from '../lib/asynchandler';
import { fechaISO, hoyEnZona } from '../lib/edad';
import { crearClienteConCodigo, errorPassword, normalizarPerfil } from '../services/cliente.service';

// Rutas de la plataforma web (staff). Móntalas detrás de tu middleware de autenticación de administrador.
const router = Router();

router.param('id', (_req, res, next, id) => {
    if (!isValidObjectId(id)) return res.status(400).json({ error: 'ID de cliente inválido' });
    next();
});

const esObjeto = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);

// Consulta: ?estatus=activo|inactivo & ?q=texto (nombre, apellidos, correo, código)
router.get('/', asyncHandler(async (req, res) => {
    const filtro: Record<string, any> = {};
    const { estatus, q } = req.query;
    if (estatus === 'activo' || estatus === 'inactivo') filtro.estatus = estatus;
    if (typeof q === 'string' && q.trim()) {
        const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filtro.$or = [{ nombre: rx }, { apellidos: rx }, { correo: rx }, { codigoAcceso: rx }];
    }
    const clientes = await Cliente.find(filtro).sort({ fechaRegistro: -1, fechaCreacion: -1 });
    res.json(clientes);
}));

// Perfil completo (datos generales, salud, actividad y membresía).
router.get('/:id', asyncHandler(async (req, res) => {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
}));

// Registro. La contraseña es opcional: solo sirve para que el cliente entre a la app móvil.
router.post('/', asyncHandler(async (req, res) => {
    const { error, datos: base } = normalizarPerfil(req.body, { parcial: false });
    if (error) return res.status(400).json({ error });
    const datos = base as Record<string, any>;

    if (req.body.password !== undefined && req.body.password !== '') {
        const errPass = errorPassword(req.body.password);
        if (errPass) return res.status(400).json({ error: errPass });
        datos.password = await bcrypt.hash(req.body.password, 10);
    }

    if (await Cliente.exists({ correo: datos.correo })) {
        return res.status(409).json({ error: 'Ya existe un cliente registrado con ese correo' });
    }

    const nuevo = await crearClienteConCodigo(datos as any);
    res.status(201).json(nuevo);
}));

// Edición de datos generales. No cambia el estatus: para eso están /baja y /reactivar.
router.patch('/:id', asyncHandler(async (req, res) => {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { error, datos: base } = normalizarPerfil(req.body, { parcial: true });
    if (error) return res.status(400).json({ error });
    const datos = base as Record<string, any>;

    if (datos.correo && datos.correo !== cliente.correo) {
        const enUso = await Cliente.exists({ correo: datos.correo, _id: { $ne: cliente._id } });
        if (enUso) return res.status(409).json({ error: 'Ese correo ya está en uso por otro cliente' });
    }

    const cambiaPassword = req.body.password !== undefined && req.body.password !== '';
    if (cambiaPassword) {
        const errPass = errorPassword(req.body.password);
        if (errPass) return res.status(400).json({ error: errPass });
        datos.password = await bcrypt.hash(req.body.password, 10);
    }

    cliente.set(datos);
    await cliente.save();
    // Si el staff cambia la contraseña, se cierran las sesiones abiertas del cliente.
    if (cambiaPassword) await Cliente.updateOne({ _id: cliente._id }, { $inc: { tokenVersion: 1 } });

    res.json(cliente);
}));

// Baja lógica: el cliente conserva todo su historial y se cierran sus sesiones en la app.
router.patch('/:id/baja', asyncHandler(async (req, res) => {
    const cliente = await Cliente.findByIdAndUpdate(
        req.params.id,
        { estatus: 'inactivo', fechaBaja: fechaISO(hoyEnZona()), $inc: { tokenVersion: 1 } },
        { new: true }
    );
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
}));

router.patch('/:id/reactivar', asyncHandler(async (req, res) => {
    const cliente = await Cliente.findByIdAndUpdate(
        req.params.id,
        { estatus: 'activo', fechaBaja: null },
        { new: true }
    );
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
}));

// Secciones del perfil completo.
const actualizarSeccion = (campo: 'perfilSalud' | 'perfilActividad' | 'membresia') =>
    asyncHandler(async (req, res) => {
        if (!esObjeto(req.body)) return res.status(400).json({ error: 'Se esperaba un objeto JSON' });
        const cliente = await Cliente.findByIdAndUpdate(
            req.params.id,
            { [campo]: req.body },
            { new: true, runValidators: true }
        );
        if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
        res.json(cliente);
    });

router.patch('/:id/salud', actualizarSeccion('perfilSalud'));
router.patch('/:id/actividad', actualizarSeccion('perfilActividad'));
router.patch('/:id/membresia', actualizarSeccion('membresia'));

// Los clientes no se eliminan.
router.delete('/:id', (_req, res) => {
    res.status(405).json({ error: 'Los clientes no se eliminan. Usa PATCH /:id/baja para darlos de baja.' });
});

router.use(manejarErrores);

export default router;