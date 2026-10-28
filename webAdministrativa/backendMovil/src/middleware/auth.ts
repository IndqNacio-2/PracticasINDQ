import type { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import jwt from 'jsonwebtoken';
import { Cliente } from '../models/cliente';

export const AUDIENCIA = 'movil-clientes';

export function secreto(): string {
    const s = process.env.CLIENTES_JWT_SECRET;
    if (!s) throw new Error('Falta CLIENTES_JWT_SECRET en el archivo .env');
    return s;
}

/**
 * Exige un token de cliente (Authorization: Bearer ...) y carga al cliente en res.locals.cliente.
 * Rechaza a los clientes dados de baja aunque su token siga vigente.
 */
export async function requireCliente(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar' });

    let id: string;
    try {
        const payload = jwt.verify(token, secreto(), { audience: AUDIENCIA });
        id = String(typeof payload === 'object' ? payload.sub : '');
    } catch {
        return res.status(401).json({ error: 'Tu sesión expiró. Inicia sesión de nuevo' });
    }
    if (!isValidObjectId(id)) return res.status(401).json({ error: 'Sesión inválida' });

    const cliente = await Cliente.findById(id);
    if (!cliente) return res.status(401).json({ error: 'Sesión inválida' });
    if (String(cliente.estatus) !== 'activo') return res.status(403).json({ error: 'Tu cuenta está inactiva' });

    res.locals.cliente = cliente;
    next();
}
