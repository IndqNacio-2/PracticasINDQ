import type { Request, Response, NextFunction } from 'express';

// Límite sencillo en memoria por IP (suficiente para frenar fuerza bruta en login/registro).
export function limitar(maximo: number, ventanaMs: number) {
    const intentos = new Map<string, { n: number; desde: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
        const ahora = Date.now();
        const clave = req.ip ?? 'desconocida';
        const actual = intentos.get(clave);

        if (!actual || ahora - actual.desde > ventanaMs) {
            intentos.set(clave, { n: 1, desde: ahora });
        } else if (++actual.n > maximo) {
            const espera = Math.ceil((actual.desde + ventanaMs - ahora) / 60000);
            return res.status(429).json({ error: `Demasiados intentos. Espera ${espera} min e inténtalo de nuevo` });
        }

        // Limpieza ocasional para que el mapa no crezca sin fin
        if (intentos.size > 5000) {
            for (const [k, v] of intentos) if (ahora - v.desde > ventanaMs) intentos.delete(k);
        }
        next();
    };
}
