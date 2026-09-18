import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { usuarios } from '../data/usuarios';
import { requireAuth } from '../middleware/auth';

const router = Router();

// POST /api/auth/login  { correo, password }
router.post('/login', (req, res) => {
  const { correo, password } = req.body ?? {};

  if (typeof correo !== 'string' || typeof password !== 'string' || !correo || !password) {
    return res.status(400).json({ message: 'Correo y contraseña son obligatorios.' });
  }

  const usuario = usuarios.find(u => u.correo.toLowerCase() === correo.toLowerCase());
  const valido =
    usuario !== undefined &&
    usuario.estatus === 'activo' &&
    bcrypt.compareSync(password, usuario.passwordHash);

  if (!usuario || !valido) {
    return res.status(401).json({ message: 'Credenciales incorrectas o usuario inactivo.' });
  }

  const token = jwt.sign({ rol: usuario.rol }, process.env.JWT_SECRET!, {
    subject: String(usuario.id),
    expiresIn: '8h',
  });

  const { passwordHash, ...publico } = usuario;
  return res.json({ token, user: publico });
});

// GET /api/auth/me  (requiere Authorization: Bearer <token>)
router.get('/me', requireAuth, (req, res) => {
  const usuario = usuarios.find(u => u.id === req.auth!.id);
  if (!usuario || usuario.estatus !== 'activo') {
    return res.status(401).json({ message: 'Usuario no disponible.' });
  }
  const { passwordHash, ...publico } = usuario;
  return res.json({ user: publico });
});

export default router;