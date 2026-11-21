const jwt = require('jsonwebtoken');

// Pueden operar el checador:
//   - el administrador (rol 'administrador' del token), y
//   - los usuarios cuyo identificador esté en CHECADOR_USUARIOS_AUTORIZADOS (lista de ids, no de códigos de asistencia).
// Recepción y los demás roles no tienen acceso a menos que su id esté en esa lista.
function accesoChecador(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ') || !process.env.JWT_SECRET) throw new Error('Sesión requerida');
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub) throw new Error('Sesión inválida');
    const autorizados = String(process.env.CHECADOR_USUARIOS_AUTORIZADOS || '')
      .split(',').map(id => id.trim()).filter(Boolean);
    const esAdministrador = payload.rol === 'administrador';
    if (!esAdministrador && !autorizados.includes(String(payload.sub))) {
      return res.status(403).json({ error: 'Este usuario no está autorizado para operar el checador.' });
    }
    req.operadorChecador = { id: String(payload.sub) };
    return next();
  } catch {
    return res.status(401).json({ error: 'Inicia sesión para operar el checador.' });
  }
}

module.exports = { accesoChecador };