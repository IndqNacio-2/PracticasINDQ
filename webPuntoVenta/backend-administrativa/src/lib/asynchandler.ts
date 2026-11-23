import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Envuelve un handler async para que sus errores lleguen al manejador de errores. */
export const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
        (req, res, next) => {
            fn(req, res, next).catch(next);
        };

/** Manejador compartido de errores (se monta con router.use al final). */
export function manejarErrores(err: any, _req: Request, res: Response, _next: NextFunction) {
    if (err?.code === 11000) {
        const campo = Object.keys(err.keyPattern ?? {})[0];
        const mensaje = campo === 'correo'
            ? 'Ya existe un cliente registrado con ese correo'
            : 'Ya existe un registro con esos datos';
        return res.status(409).json({ error: mensaje });
    }
    if (err?.name === 'ValidationError') {
        const detalle = Object.values(err.errors ?? {}).map((e: any) => e.message).join(' ');
        return res.status(400).json({ error: detalle || 'Datos inválidos' });
    }
    if (err?.name === 'CastError') {
        return res.status(400).json({ error: 'Dato con formato inválido' });
    }
    console.error(`[administrativa ${_req.baseUrl}]`, err);
    if (err?.code === '42P01') {
        return res.status(503).json({ error: 'Falta una tabla requerida. Para el historial de inventario ejecuta npm run db:migrar-inventario desde backend-administrativa.' });
    }
    return res.status(500).json({ error: 'Error interno del servidor' });
}