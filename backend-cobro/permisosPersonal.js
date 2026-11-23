const jwt = require('jsonwebtoken');

function accesoPersonal(roles, mensaje) {
 return function (req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ') || !process.env.JWT_SECRET) throw new Error('Token requerido');
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || typeof payload.sub !== 'string' || !/^[a-f\d]{24}$/i.test(payload.sub)) throw new Error('Token inválido');
    const rol = String(payload.rol ?? '').trim().toLowerCase();
    if (!roles.includes(rol)) return res.status(403).json({ error: 'No tienes permiso para esta operación.' });
    req.personal = { id: payload.sub, rol };
    next();
  } catch {
    return res.status(401).json({ error: mensaje });
  }
 };
}

const accesoClientes = accesoPersonal(['administrador', 'recepcion', 'vendedor'], 'Inicia sesión para consultar o modificar clientes.');
const accesoReservasCobros = accesoPersonal(['administrador', 'recepcion'], 'Inicia sesión para consultar u operar reservaciones y cobros.');

module.exports = { accesoClientes, accesoReservasCobros };