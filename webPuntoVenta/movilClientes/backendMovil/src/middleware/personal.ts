import type { NextFunction, Request, Response } from 'express';

// Sesión del PERSONAL (administrador o recepción) en la app móvil, por ejemplo para escanear el código de una reservación.
// La sesión la crea la API administrativa (POST /admin/api/auth/login): aquí se valida el mismo token con /auth/me.
// En el gateway unificado el valor por defecto de ADMIN_API_URL ya es correcto.
export const ADMIN_API_URL = process.env.ADMIN_API_URL ?? 'http://localhost:3000/admin/api';

export async function requirePersonal(req: Request, res: Response, next: NextFunction) {
    const autorizacion = req.headers.authorization;
    if (!autorizacion?.startsWith('Bearer ')) return res.status(401).json({ error: 'Inicia sesión como personal para continuar' });
    try {
        const r = await fetch(`${ADMIN_API_URL}/auth/me`, { headers: { Authorization: autorizacion }, signal: AbortSignal.timeout(8000) });
        if (!r.ok) return res.status(r.status === 401 ? 401 : 503).json({ error: 'No se pudo validar tu sesión' });
        const { user } = (await r.json()) as { user?: { rol?: string; estatus?: string } };
        if (!user || user.estatus !== 'activo' || !['administrador', 'recepcion'].includes(user.rol ?? '')) {
            return res.status(403).json({ error: 'Solo el personal puede confirmar asistencias' });
        }
        next();
    } catch {
        res.status(503).json({ error: 'Administración no está disponible para validar la sesión' });
    }
}
