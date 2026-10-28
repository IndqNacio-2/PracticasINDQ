import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../lib/post';
import { requireAuth } from '../middleware/auth';
import { COLUMNAS_USUARIO, toPublico, type UsuarioRow } from '../lib/usuarios';

const router = Router();

// POST /api/auth/login  { correo, password }
router.post('/login', async (req, res) => {
  const { correo, password } = req.body ?? {};

  if (typeof correo !== 'string' || typeof password !== 'string' || !correo || !password) {
    return res.status(400).json({ message: 'Correo y contraseña son obligatorios.' });
  }

  try {
    const { rows } = await pool.query<UsuarioRow>(
      `SELECT ${COLUMNAS_USUARIO} FROM webadministrativa.usuarios WHERE correo = $1`,
      [correo.trim().toLowerCase()]
    );
    const usuario = rows[0];

    const valido =
      usuario !== undefined &&
      usuario.estatus === true &&
      bcrypt.compareSync(password, usuario.password_hash);

    if (!usuario || !valido) {
      return res.status(401).json({ message: 'Credenciales incorrectas o usuario inactivo.' });
    }

    const token = jwt.sign({ rol: usuario.rol }, process.env.JWT_SECRET!, {
      subject: String(usuario.id_usuario),
      expiresIn: '8h',
    });

    return res.json({ token, user: toPublico(usuario) });
  } catch (err) {
    console.error('Error en login:', err);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/auth/me  (requiere Authorization: Bearer <token>)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query<UsuarioRow>(
      `SELECT ${COLUMNAS_USUARIO} FROM webadministrativa.usuarios WHERE id_usuario = $1`,
      [req.auth!.id]
    );
    const usuario = rows[0];

    if (!usuario || usuario.estatus !== true) {
      return res.status(401).json({ message: 'Usuario no disponible.' });
    }
    return res.json({ user: toPublico(usuario) });
  } catch (err) {
    console.error('Error en /me:', err);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
