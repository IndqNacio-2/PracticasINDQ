//authlclientes.ts
import type { NextFunction, Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { ClienteModel, type ClienteDocumento } from '../models/Clientes/clienteTipado';

export type { ClienteDocumento };
export interface ClienteRequest extends Request { cliente?: ClienteDocumento }

const EXPIRA = (process.env.JWT_CLIENTES_EXPIRA ?? '30d') as SignOptions['expiresIn'];

// Secreto distinto al de la plataforma web: un token de cliente nunca sirve como token de staff.
function secreto(): string {
    const s = process.env.JWT_SECRET_CLIENTES;
    if (!s || s.length < 32) throw new Error('Define JWT_SECRET_CLIENTES en el .env (mínimo 32 caracteres)');
    return s;
}

/** Firma el token de sesión. `tokenVersion` permite invalidarlo al cerrar sesión. */
export function firmarToken(idCliente: string, tokenVersion: number): string {
    return jwt.sign({ tv: tokenVersion }, secreto(), { subject: idCliente, expiresIn: EXPIRA });
}

export async function authCliente(req: Request, res: Response, next: NextFunction) {
    const encabezado = req.headers.authorization ?? '';
    const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar' });

    let cliente: ClienteDocumento | null = null;
    try {
        const payload = jwt.verify(token, secreto()) as jwt.JwtPayload;
        cliente = await ClienteModel.findById(payload.sub).select('+tokenVersion');
        if (!cliente || (cliente.tokenVersion ?? 0) !== payload.tv) {
            return res.status(401).json({ error: 'La sesión expiró o fue cerrada' });
        }
    } catch {
        return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }

    if (cliente.estatus !== 'activo') {
        return res.status(403).json({ error: 'Tu cuenta está dada de baja. Contacta al gimnasio.' });
    }
    (req as ClienteRequest).cliente = cliente;
    next();
}