import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../models/Usuarios/usuarios';

declare global {
  namespace Express {
    interface Request {
      // id es el ObjectId (string) del usuario en MongoDB.
      auth?: { id: string; rol: UserRole };
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
    req.auth = { id: String(payload.sub), rol: payload.rol as UserRole };
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado.' });
  }
}

const normalizar = (valor: unknown): string =>
  typeof valor === 'string' ? valor.trim().toLowerCase() : '';

export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const rolUsuario = normalizar(req.auth?.rol);
    const permitidos = roles.map(normalizar);

    if (!req.auth || !rolUsuario || !permitidos.includes(rolUsuario)) {
      return res.status(403).json({ message: 'No tienes permiso para esta acción.' });
    }
    next();
  };