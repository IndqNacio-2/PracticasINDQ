//appclientes.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { ClienteModel as Cliente } from './clienteTipado';
import { asyncHandler, manejarErrores } from '../../lib/asynchandler';
import { authCliente, firmarToken, type ClienteRequest } from '../../middleware/authclientes';
import { crearClienteConCodigo, errorPassword, normalizarPerfil } from '../../services/cliente.service';
import { felicitarSiCumple } from '../../services/cumpleanos.service';

// Endpoints públicos para la app móvil. Montar en /api/app/clientes (sin el middleware de administrador).
const router = Router();

// Frena fuerza bruta en registro e inicio de sesión (20 intentos por IP cada 15 min).
const limiteAuth = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' },
});

// Se compara contra este hash cuando el correo no existe, para que el tiempo de respuesta no delate si la cuenta existe.
const HASH_FALSO = bcrypt.hashSync('contraseña-inexistente', 10);

// POST /registro — el cliente crea su cuenta.
router.post('/registro', limiteAuth, asyncHandler(async (req, res) => {
    const { error, datos: base } = normalizarPerfil(req.body, {
        parcial: false,
        exigirFechaNacimiento: true,
        permitirPerfiles: true,
    });
    if (error) return res.status(400).json({ error });
    const datos = base as Record<string, any>;

    const errPass = errorPassword(req.body.password);
    if (errPass) return res.status(400).json({ error: errPass });

    if (await Cliente.exists({ correo: datos.correo })) {
        return res.status(409).json({ error: 'Ya existe una cuenta con ese correo. Si ya eres cliente, pide a recepción que active tu acceso.' });
    }

    const cliente: any = await crearClienteConCodigo({
        ...datos,
        password: await bcrypt.hash(req.body.password, 10),
    } as any);
    res.status(201).json({ token: firmarToken(String(cliente._id), 0), cliente });
    void felicitarSiCumple(cliente);
}));

// POST /login
router.post('/login', limiteAuth, asyncHandler(async (req, res) => {
    const correo = String(req.body?.correo ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!correo || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });

    const cliente = await Cliente.findOne({ correo }).select('+password +tokenVersion');
    const coincide = await bcrypt.compare(password, cliente?.password ?? HASH_FALSO);
    if (!cliente || !cliente.password || !coincide) {
        return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }
    if (cliente.estatus !== 'activo') {
        return res.status(403).json({ error: 'Tu cuenta está dada de baja. Contacta al gimnasio.' });
    }

    await Cliente.updateOne({ _id: cliente._id }, { ultimoAcceso: new Date() });
    res.json({ token: firmarToken(String(cliente._id), cliente.tokenVersion ?? 0), cliente });
}));

// POST /logout — invalida los tokens emitidos hasta ahora (cierra la sesión en todos los dispositivos).
router.post('/logout', authCliente, asyncHandler(async (req, res) => {
    const { cliente } = req as ClienteRequest;
    await Cliente.updateOne({ _id: cliente!._id }, { $inc: { tokenVersion: 1 } });
    res.json({ mensaje: 'Sesión cerrada' });
}));

// GET /perfil — el cliente consulta su información.
router.get('/perfil', authCliente, (req, res) => {
    res.json((req as ClienteRequest).cliente);
});

// PATCH /perfil — el cliente actualiza sus datos, su perfil de salud y su perfil de actividad.
// No puede cambiar estatus, código de acceso, rol ni membresía.
router.patch('/perfil', authCliente, asyncHandler(async (req, res) => {
    const { cliente } = req as ClienteRequest;
    const { error, datos: base } = normalizarPerfil(req.body, { parcial: true, permitirPerfiles: true });
    if (error) return res.status(400).json({ error });
    const datos = base as Record<string, any>;

    if (datos.correo && datos.correo !== cliente!.correo) {
        const enUso = await Cliente.exists({ correo: datos.correo, _id: { $ne: cliente!._id } });
        if (enUso) return res.status(409).json({ error: 'Ese correo ya está en uso' });
    }

    cliente!.set(datos);
    await cliente!.save();
    res.json(cliente);
}));

// PATCH /password — cambia la contraseña y devuelve un token nuevo (los demás quedan invalidados).
router.patch('/password', authCliente, limiteAuth, asyncHandler(async (req, res) => {
    const { cliente } = req as ClienteRequest;
    const errPass = errorPassword(req.body?.passwordNueva);
    if (errPass) return res.status(400).json({ error: errPass });

    const doc = await Cliente.findById(cliente!._id).select('+password +tokenVersion');
    const actualOk = doc?.password
        ? await bcrypt.compare(String(req.body?.passwordActual ?? ''), doc.password)
        : false;
    if (!doc || !actualOk) return res.status(401).json({ error: 'La contraseña actual es incorrecta' });

    doc.password = await bcrypt.hash(req.body.passwordNueva, 10);
    doc.tokenVersion = (doc.tokenVersion ?? 0) + 1;
    await doc.save();
    res.json({ mensaje: 'Contraseña actualizada', token: firmarToken(String(doc._id), doc.tokenVersion) });
}));

router.use(manejarErrores);

export default router;