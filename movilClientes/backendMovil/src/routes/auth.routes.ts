import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { Cliente } from '../models/cliente';
import { AUDIENCIA, secreto } from '../middleware/auth';
import { limitar } from '../middleware/limitar';
import { perfilPublico } from '../lib/vista';
import { validarCorreo, validarPassword } from '../lib/validar';
import { MENSAJE_SIN_ACTIVAR, registrarCliente } from '../clientes-core/cliente.core';

const router = Router();

// 10 intentos cada 15 minutos por IP (se puede cambiar con AUTH_INTENTOS_MAX en el .env)
const limite = limitar(Number(process.env.AUTH_INTENTOS_MAX) || 10, 15 * 60 * 1000);

// Hash de relleno: así login tarda lo mismo exista o no el correo
const HASH_RELLENO = bcrypt.hashSync('relleno-no-valido', 10);

// tv = versión de sesión del cliente. Si la web cambia su contraseña o lo da de baja, sube y el token deja de servir.
function firmar(idCliente: string, tokenVersion = 0): string {
    return jwt.sign({ tv: tokenVersion }, secreto(), {
        subject: idCliente,
        audience: AUDIENCIA,
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '30d') as SignOptions['expiresIn'],
    });
}

const SIN_ACTIVAR = { error: MENSAJE_SIN_ACTIVAR, codigo: 'CUENTA_SIN_ACTIVAR' };

// POST /api/auth/registro
// { nombre, apellidos, fechaNacimiento, correo, telefono, password, confirmarPassword, foto? }
// Usa el mismo alta que la web administrativa (clientes-core): mismo código de acceso, edad y validaciones.
router.post('/registro', limite, async (req, res) => {
    const r = await registrarCliente(req.body, 'movil');
    if (!r.ok) return res.status(r.status).json({ error: r.error, ...(r.codigo ? { codigo: r.codigo } : {}) });
    res.status(201).json({ token: firmar(String(r.cliente._id), 0), cliente: perfilPublico(r.cliente) });
});

// POST /api/auth/login  { correo, password }
router.post('/login', limite, async (req, res) => {
    const correo = String(req.body?.correo ?? '').trim().toLowerCase();
    const password = req.body?.password;
    if (!correo || typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }

    const cliente = await Cliente.findOne({ correo }).select('+password +tokenVersion');
    if (cliente && !cliente.password) return res.status(409).json(SIN_ACTIVAR);

    const valido = bcrypt.compareSync(password, cliente?.password ?? HASH_RELLENO);
    if (!cliente || !valido) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    if (String(cliente.estatus) !== 'activo') return res.status(403).json({ error: 'Tu cuenta está inactiva' });

    await Cliente.updateOne({ _id: cliente._id }, { ultimoAcceso: new Date() });
    res.json({ token: firmar(String(cliente._id), cliente.tokenVersion ?? 0), cliente: perfilPublico(cliente) });
});

// POST /api/auth/activar-cuenta  { correo, codigoAcceso, password, confirmarPassword }
// Para clientes dados de alta en recepción: el código de acceso demuestra que son ellos.
router.post('/activar-cuenta', limite, async (req, res) => {
    const correo = validarCorreo(req.body?.correo);
    const codigo = String(req.body?.codigoAcceso ?? '').trim().toUpperCase();
    const password = validarPassword(req.body?.password, req.body?.confirmarPassword);
    if (!correo.ok || !codigo) return res.status(400).json({ error: 'Correo y código de acceso son obligatorios' });
    if (!password.ok) return res.status(400).json({ error: password.error });

    const cliente = await Cliente.findOne({ correo: correo.valor }).select('+password +tokenVersion');
    const codigoCorrecto = !!cliente && String(cliente.codigoAcceso).toUpperCase() === codigo;
    if (!cliente || !codigoCorrecto) return res.status(401).json({ error: 'Correo o código de acceso incorrectos' });
    if (cliente.password) return res.status(409).json({ error: 'Esa cuenta ya está activada. Inicia sesión' });
    if (String(cliente.estatus) !== 'activo') return res.status(403).json({ error: 'Tu cuenta está inactiva' });

    cliente.password = bcrypt.hashSync(password.valor, 10);
    await cliente.save();
    res.json({ token: firmar(String(cliente._id), cliente.tokenVersion ?? 0), cliente: perfilPublico(cliente) });
});

export default router;
