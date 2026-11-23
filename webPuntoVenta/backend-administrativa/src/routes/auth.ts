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
  const usuario: any = await Usuario.findOne({ correo: correo.trim().toLowerCase() }).select('+password');

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

// Solo permite cambiar la contraseña de la identidad autenticada.
router.post('/cambiar-password', requireAuth, async (req, res) => {
  const { passwordActual, passwordNueva } = req.body ?? {};
  if (typeof passwordActual !== 'string' || typeof passwordNueva !== 'string' || !passwordActual) {
    return res.status(400).json({ message: 'La contraseña actual y la nueva son obligatorias.' });
  }
  // bcrypt solo utiliza hasta 72 bytes; no aceptar contraseñas truncadas.
  if (passwordNueva.length < 8 || Buffer.byteLength(passwordNueva, 'utf8') > 72) {
    return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres y no superar 72 bytes.' });
  }
  if (passwordNueva === passwordActual) {
    return res.status(400).json({ message: 'La nueva contraseña debe ser distinta a la actual.' });
  }

  const usuario: any = await Usuario.findById(req.auth!.id).select('+password');
  if (!usuario || usuario.estatus !== 'activo' || !await bcrypt.compare(passwordActual, usuario.password)) {
    return res.status(401).json({ message: 'La contraseña actual no es correcta o el usuario no está disponible.' });
  }
  const password = await bcrypt.hash(passwordNueva, 10);
  // Evita sobreescribir otro cambio de contraseña realizado simultáneamente.
  const resultado = await Usuario.updateOne(
    { _id: usuario._id, password: usuario.password, estatus: 'activo' },
    { $set: { password } },
    { runValidators: true },
  );
  if (resultado.modifiedCount !== 1) {
    return res.status(409).json({ message: 'La cuenta cambió durante la operación. Vuelve a iniciar sesión.' });
  }
  return res.json({ message: 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.' });
});

export default router;