import type { Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from './auth';

// Mantiene las consultas compartidas que utilizan Cobro y las aplicaciones.
// Las escrituras de programación solo corresponden a Administración y Recepción.
export function accesoProgramacion(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return requireAuth(req, res, () => requireRole('administrador', 'recepcion')(req, res, next));
}