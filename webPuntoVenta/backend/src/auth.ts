import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface PosUser { id: string; role: string }

export function requirePosUser(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ') || !process.env.JWT_SECRET) throw new Error('Token requerido');
    const token = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof token === 'string' || !token.sub) throw new Error('Token inválido');
    const role = String(token.rol).trim().toLowerCase();
    if (!['vendedor', 'administrador'].includes(role)) {
      res.status(403).json({ message: 'No tienes permiso para ingresar al punto de venta.' });
      return;
    }
    res.locals.posUser = { id: token.sub, role } satisfies PosUser;
    next();
  } catch {
    res.status(401).json({ message: 'Inicia sesión para consultar o registrar tus ventas.' });
  }
}