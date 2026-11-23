const jwt = require('jsonwebtoken');

function accesoClientes(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ') || !process.env.JWT_SECRET) throw new Error('Token requerido');
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub) throw new Error('Token inválido');
    const rol = String(payload.rol ?? '').trim().toLowerCase();
    if (!['administrador', 'recepcion', 'vendedor'].includes(rol)) return res.status(403).json({ error: 'No tienes permiso para administrar clientes.' });
    req.personal = { id: payload.sub, rol };
    next();
  } catch {
    return res.status(401).json({ error: 'Inicia sesión para consultar o modificar clientes.' });
  }
}

module.exports = { accesoClientes };