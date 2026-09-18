import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../data/usuarios';

declare global {
  namespace Express {
    interface Request {
      auth?: { id: number; rol: UserRole };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token requerido.' });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as jwt.JwtPayload;
    req.auth = { id: Number(payload.sub), rol: payload.rol as UserRole };
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado.' });
  }
}

export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.rol)) {
      return res.status(403).json({ message: 'No tienes permiso para esta acción.' });
    }
    next();
  };