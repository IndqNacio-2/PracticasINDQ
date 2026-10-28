import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { Cliente } from '../models/cliente';
import { AUDIENCIA, secreto } from '../middleware/auth';
import { limitar } from '../middleware/limitar';
import { campoDuplicado, codigoAccesoCliente } from '../lib/codigo';
import { perfilPublico } from '../lib/vista';
import {
    validarCelular, validarCorreo, validarFechaNacimiento, validarFoto, validarNombre, validarPassword,
} from '../lib/validar';

const router = Router();

// 10 intentos cada 15 minutos por IP (se puede cambiar con AUTH_INTENTOS_MAX en el .env)
const limite = limitar(Number(process.env.AUTH_INTENTOS_MAX) || 10, 15 * 60 * 1000);

// Hash de relleno: así login tarda lo mismo exista o no el correo
const HASH_RELLENO = bcrypt.hashSync('relleno-no-valido', 10);

function firmar(idCliente: string): string {
    return jwt.sign({}, secreto(), {
        subject: idCliente,
        audience: AUDIENCIA,
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '30d') as SignOptions['expiresIn'],
    });
}

const SIN_ACTIVAR = {
    error: 'Tu cuenta aún no tiene contraseña. Actívala con el código de acceso que te dieron en el gimnasio',
    codigo: 'CUENTA_SIN_ACTIVAR',
};

// POST /api/auth/registro
// { nombre, apellidos, fechaNacimiento, correo, telefono, password, confirmarPassword, foto? }
router.post('/registro', limite, async (req, res) => {
    const b = req.body ?? {};
    const nombre = validarNombre(b.nombre, 'El nombre');
    if (!nombre.ok) return res.status(400).json({ error: nombre.error });
    const apellidos = validarNombre(b.apellidos, 'Los apellidos');
    if (!apellidos.ok) return res.status(400).json({ error: apellidos.error });
    const nacimiento = validarFechaNacimiento(b.fechaNacimiento);
    if (!nacimiento.ok) return res.status(400).json({ error: nacimiento.error });
    const correo = validarCorreo(b.correo);
    if (!correo.ok) return res.status(400).json({ error: correo.error });
    const celular = validarCelular(b.telefono);
    if (!celular.ok) return res.status(400).json({ error: celular.error });
    const password = validarPassword(b.password, b.confirmarPassword);
    if (!password.ok) return res.status(400).json({ error: password.error });
    const foto = validarFoto(b.foto);
    if (!foto.ok) return res.status(400).json({ error: foto.error });

    const existente = await Cliente.findOne({ correo: correo.valor }).select('+passwordHash');
    if (existente) {
        return existente.passwordHash
            ? res.status(409).json({ error: 'Ya existe una cuenta con ese correo' })
            : res.status(409).json(SIN_ACTIVAR);
    }

    const passwordHash = bcrypt.hashSync(password.valor, 10);
    for (let intento = 0; intento < 5; intento++) {
        try {
            const cliente = await Cliente.create({
                nombre: nombre.valor,
                apellidos: apellidos.valor,
                correo: correo.valor,
                telefono: celular.valor,
                fechaNacimiento: nacimiento.valor,
                avatar: foto.valor || undefined,
                codigoAcceso: codigoAccesoCliente(),
                estatus: 'activo',
                rol: 'cliente',
                membresia: null,
                passwordHash,
            });
            return res.status(201).json({ token: firmar(String(cliente._id)), cliente: perfilPublico(cliente) });
        } catch (err) {
            const campo = campoDuplicado(err);
            if (campo === 'correo') return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
            if (campo !== 'codigoAcceso') throw err; // si solo chocó el código aleatorio, se reintenta
        }
    }
    return res.status(500).json({ error: 'No se pudo crear la cuenta. Inténtalo de nuevo' });
});

// POST /api/auth/login  { correo, password }
router.post('/login', limite, async (req, res) => {
    const correo = String(req.body?.correo ?? '').trim().toLowerCase();
    const password = req.body?.password;
    if (!correo || typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }

    const cliente = await Cliente.findOne({ correo }).select('+passwordHash');
    if (cliente && !cliente.passwordHash) return res.status(409).json(SIN_ACTIVAR);

    const valido = bcrypt.compareSync(password, cliente?.passwordHash ?? HASH_RELLENO);
    if (!cliente || !valido) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    if (String(cliente.estatus) !== 'activo') return res.status(403).json({ error: 'Tu cuenta está inactiva' });

    res.json({ token: firmar(String(cliente._id)), cliente: perfilPublico(cliente) });
});

// POST /api/auth/activar-cuenta  { correo, codigoAcceso, password, confirmarPassword }
// Para clientes dados de alta en recepción: el código de acceso demuestra que son ellos.
router.post('/activar-cuenta', limite, async (req, res) => {
    const correo = validarCorreo(req.body?.correo);
    const codigo = String(req.body?.codigoAcceso ?? '').trim().toUpperCase();
    const password = validarPassword(req.body?.password, req.body?.confirmarPassword);
    if (!correo.ok || !codigo) return res.status(400).json({ error: 'Correo y código de acceso son obligatorios' });
    if (!password.ok) return res.status(400).json({ error: password.error });

    const cliente = await Cliente.findOne({ correo: correo.valor }).select('+passwordHash');
    const codigoCorrecto = !!cliente && String(cliente.codigoAcceso).toUpperCase() === codigo;
    if (!cliente || !codigoCorrecto) return res.status(401).json({ error: 'Correo o código de acceso incorrectos' });
    if (cliente.passwordHash) return res.status(409).json({ error: 'Esa cuenta ya está activada. Inicia sesión' });
    if (String(cliente.estatus) !== 'activo') return res.status(403).json({ error: 'Tu cuenta está inactiva' });

    cliente.passwordHash = bcrypt.hashSync(password.valor, 10);
    await cliente.save();
    res.json({ token: firmar(String(cliente._id)), cliente: perfilPublico(cliente) });
});

export default router;
