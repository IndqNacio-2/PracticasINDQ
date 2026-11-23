// ============================================================================
// Autorización por rol para el backend de cobro.
//
// Este backend no emite tokens: la sesión del personal la crea la API administrativa
// (/admin/api/auth/login). Aquí se valida el mismo token preguntándole a /auth/me,
// igual que ya hace membresiasService.js, y se revisa que el rol esté permitido.
//
// Uso:   app.get('/api/algo', requerirRol(ADMIN_API, 'administrador'), handler)
// Roles: 'administrador' | 'recepcion' (cobro) | 'vendedor' (punto de venta)
// ============================================================================
function requerirRol(adminApi, ...roles) {
  return async function autorizar(req, res, next) {
    try {
      if (!req.headers.authorization?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Inicia sesión para continuar.' });
      }
      const r = await fetch(`${adminApi}/auth/me`, {
        headers: { Authorization: req.headers.authorization },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) {
        return res.status(r.status === 401 ? 401 : 503).json({ error: 'No se pudo validar tu sesión.' });
      }
      const { user } = await r.json();
      if (!user || user.estatus !== 'activo' || !roles.includes(user.rol)) {
        return res.status(403).json({ error: 'No tienes permiso para esta acción.' });
      }
      req.personal = user;
      next();
    } catch {
      res.status(503).json({ error: 'Administración no está disponible para validar la sesión.' });
    }
  };
}

module.exports = { requerirRol };
