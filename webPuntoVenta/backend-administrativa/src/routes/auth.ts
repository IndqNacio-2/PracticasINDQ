import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Usuario } from '../models/Usuarios/usuarios';
import { requireAuth } from '../middleware/auth';

const router = Router();

// POST /api/auth/login  { correo, password }
// Autentica contra la colección real de usuarios (MongoDB). La contraseña se
// compara con bcrypt y, si es válida, se firma un token JWT con el rol.
router.post('/login', async (req, res) => {
  const { correo, password } = req.body ?? {};

  if (typeof correo !== 'string' || typeof password !== 'string' || !correo || !password) {
    return res.status(400).json({ message: 'Correo y contraseña son obligatorios.' });
  }

  // El campo password está en select:false, hay que pedirlo explícitamente.
  // Se castea a any para leer el hash: la inferencia de tipos de Mongoose no
  // siempre resuelve bien los campos con select:false.
  const usuario: any = await Usuario.findOne({ correo: correo.toLowerCase() }).select('+password');

  const valido =
    usuario !== null &&
    usuario.estatus === 'activo' &&
    bcrypt.compareSync(password, usuario.password);

  if (!usuario || !valido) {
    return res.status(401).json({ message: 'Credenciales incorrectas o usuario inactivo.' });
  }

  const token = jwt.sign({ rol: usuario.rol }, process.env.JWT_SECRET!, {
    subject: String(usuario._id),
    // Duración configurable en .env (JWT_EXPIRES_IN, p. ej. "1d"); si no viene,
    // se usan 8 horas por defecto.
    expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn'],
  });

  // usuario.toJSON() ya quita password (select:false + transform).
  return res.json({ token, user: usuario.toJSON() });
});

// GET /api/auth/me  (requiere Authorization: Bearer <token>)
router.get('/me', requireAuth, async (req, res) => {
  // Cast a any: la inferencia de Mongoose para este schema no es fiable.
  const usuario: any = await Usuario.findById(req.auth!.id);
  if (!usuario || usuario.estatus !== 'activo') {
    return res.status(401).json({ message: 'Usuario no disponible.' });
  }
  return res.json({ user: usuario.toJSON() });
});

export default router;