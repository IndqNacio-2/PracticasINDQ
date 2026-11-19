import { Router, type RequestHandler } from 'express';
import type { Pool, PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { normalizarCliente, perfilCompartido, validarPassword } from '../lib/cliente-compartido';
import { asyncHandler } from '../lib/asynchandler';
import { requireAuth, requireRole } from '../middleware/auth';

const AUDIENCIA = 'clientes-postgres';
const hash = (texto: string) => createHash('sha256').update(texto).digest('hex');
const columnas = "c.id, c.nombre, c.correo, c.telefono, c.activo, c.enfermedades, c.lesiones, to_jsonb(c)->>'codigo_usuario' AS codigo_usuario";
const fallo = (status: number, message: string) => Object.assign(new Error(message), { status });

export function crearRutasClientesMovil(pool: Pool, secreto: () => string | undefined = () => process.env.CLIENTES_JWT_SECRET) {
    const router = Router();
    router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    const clave = () => {
        const valor = secreto();
        if (!valor || valor.length < 32 || valor === process.env.JWT_SECRET) throw fallo(503, 'Configura CLIENTES_JWT_SECRET independiente, de al menos 32 caracteres.');
        return valor;
    };
    const firmar = (id: number, version: number) => jwt.sign({ tv: version, rol: 'cliente' }, clave(), { subject: String(id), audience: AUDIENCIA, issuer: 'clientes-compartidos', expiresIn: '8h', algorithm: 'HS256' });
    const transaccion = async <T>(fn: (db: PoolClient) => Promise<T>) => {
        const db = await pool.connect();
        try { await db.query('BEGIN'); const resultado = await fn(db); await db.query('COMMIT'); return resultado; }
        catch (error) { await db.query('ROLLBACK'); throw error; }
        finally { db.release(); }
    };

    // Limitador acotado, sin temporizadores. No confiar en X-Forwarded-For enviado por el cliente.
    const intentos = new Map<string, { total: number; hasta: number }>();
    const limitar: RequestHandler = (req, res, next) => {
        const ahora = Date.now();
        for (const [ip, v] of intentos) if (v.hasta <= ahora) intentos.delete(ip);
        const ip = req.ip ?? 'desconocida';
        const v = intentos.get(ip) ?? { total: 0, hasta: ahora + 15 * 60_000 };
        if (v.total >= 10 || (!intentos.has(ip) && intentos.size >= 10_000)) return res.status(429).json({ error: 'Demasiados intentos. Intenta más tarde.' });
        v.total++; intentos.set(ip, v); next();
    };

    router.post('/auth/registro', limitar, asyncHandler(async (req, res) => {
        clave(); // Fallar antes de escribir si no se configuró el acceso móvil.
        let datos: Record<string, unknown>, password: string;
        try { datos = normalizarCliente(req.body); password = validarPassword(req.body.password, req.body.confirmarPassword); }
        catch (e) { throw fallo(400, (e as Error).message); }
        const passwordHash = await bcrypt.hash(password, 10);
        const cliente = await transaccion(async db => {
            const existente = await db.query('SELECT id FROM webcobro.clientes WHERE LOWER(BTRIM(correo)) = $1', [datos.correo]);
            if (existente.rows.length) throw fallo(409, 'Ya existe un cliente con ese correo. Solicita activar su cuenta, no vuelvas a registrarlo.');
            const r = await db.query(`INSERT INTO webcobro.clientes (nombre, correo, telefono, membresia, enfermedades, lesiones)
                VALUES ($1, $2, $3, 'Sin membresía', $4::text[], $5::text[]) RETURNING *`,
            [datos.nombre, datos.correo, datos.telefono ?? '', datos.enfermedades ?? [], datos.lesiones ?? []]);
            await db.query('INSERT INTO webcobro.clientes_acceso_movil (cliente_id, password_hash) VALUES ($1, $2)', [r.rows[0].id, passwordHash]);
            return r.rows[0];
        });
        res.status(201).json({ token: firmar(cliente.id, 0), cliente: perfilCompartido(cliente) });
    }));

    router.post('/auth/login', limitar, asyncHandler(async (req, res) => {
        clave();
        const { correo, password } = req.body ?? {};
        if (typeof correo !== 'string' || typeof password !== 'string' || !password || Buffer.byteLength(password) > 72) throw fallo(400, 'Correo y contraseña válidos son obligatorios.');
        const r = await pool.query(`SELECT ${columnas}, a.password_hash, a.token_version FROM webcobro.clientes c
            LEFT JOIN webcobro.clientes_acceso_movil a ON a.cliente_id = c.id WHERE LOWER(BTRIM(c.correo)) = $1`, [correo.trim().toLowerCase()]);
        const c = r.rows[0];
        // También ejecutar bcrypt si no existe el correo o aún no tiene contraseña.
        const valido = await bcrypt.compare(password, c?.password_hash ?? '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
        if (!c || !c.password_hash || !valido || !c.activo) throw fallo(401, 'Credenciales incorrectas, cuenta inactiva o pendiente de activación.');
        res.json({ token: firmar(c.id, c.token_version), cliente: perfilCompartido(c) });
    }));

    // Solo personal autorizado entrega un secreto temporal. CLI-<id> NO es una contraseña.
    router.post('/clientes/:id/activacion', requireAuth, requireRole('administrador', 'recepcion'), asyncHandler(async (req, res) => {
        clave();
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) throw fallo(400, 'ID de cliente inválido.');
        const codigo = randomBytes(24).toString('base64url');
        await transaccion(async db => {
            const r = await db.query('SELECT id, activo, correo FROM webcobro.clientes WHERE id = $1 FOR UPDATE', [id]);
            if (!r.rows[0]) throw fallo(404, 'Cliente no encontrado.');
            if (!r.rows[0].activo || !r.rows[0].correo) throw fallo(409, 'Activa el cliente y completa su correo antes de habilitar la app.');
            const a = await db.query('SELECT password_hash FROM webcobro.clientes_acceso_movil WHERE cliente_id = $1', [id]);
            if (a.rows[0]?.password_hash) throw fallo(409, 'La cuenta ya está activada.');
            await db.query(`INSERT INTO webcobro.clientes_acceso_movil (cliente_id, activacion_hash, activacion_expira)
                VALUES ($1, $2, NOW() + INTERVAL '15 minutes') ON CONFLICT (cliente_id)
                DO UPDATE SET activacion_hash = EXCLUDED.activacion_hash, activacion_expira = EXCLUDED.activacion_expira`, [id, hash(codigo)]);
        });
        res.set('Cache-Control', 'no-store').json({ codigoActivacion: codigo, expiraEnSegundos: 900 });
    }));

    router.post('/auth/activar-cuenta', limitar, asyncHandler(async (req, res) => {
        clave();
        const b = req.body ?? {};
        let password: string;
        try { password = validarPassword(b.password, b.confirmarPassword); }
        catch (e) { throw fallo(400, (e as Error).message); }
        if (typeof b.correo !== 'string' || typeof b.codigoAcceso !== 'string' || b.codigoAcceso.length > 100) throw fallo(400, 'Correo y código temporal son obligatorios.');
        const passwordHash = await bcrypt.hash(password, 10);
        const c = await transaccion(async db => {
            const r = await db.query(`SELECT ${columnas}, a.token_version FROM webcobro.clientes c
                JOIN webcobro.clientes_acceso_movil a ON a.cliente_id = c.id
                WHERE LOWER(BTRIM(c.correo)) = $1 AND c.activo = TRUE AND a.password_hash IS NULL
                  AND a.activacion_hash = $2 AND a.activacion_expira > NOW() FOR UPDATE OF c, a`, [b.correo.trim().toLowerCase(), hash(b.codigoAcceso)]);
            if (!r.rows[0]) throw fallo(401, 'Código temporal inválido, vencido o ya utilizado.');
            await db.query(`UPDATE webcobro.clientes_acceso_movil SET password_hash = $2,
                activacion_hash = NULL, activacion_expira = NULL WHERE cliente_id = $1`, [r.rows[0].id, passwordHash]);
            return r.rows[0];
        });
        res.json({ token: firmar(c.id, c.token_version), cliente: perfilCompartido(c) });
    }));

    router.use('/me', asyncHandler(async (req, res, next) => {
        let payload: jwt.JwtPayload;
        const secret = clave();
        try {
            const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
            payload = jwt.verify(token, secret, { algorithms: ['HS256'], audience: AUDIENCIA, issuer: 'clientes-compartidos' }) as jwt.JwtPayload;
            if (!/^\d+$/.test(payload.sub ?? '') || payload.rol !== 'cliente') throw new Error();
        } catch { throw fallo(401, 'Sesión inválida o expirada.'); }
        const r = await pool.query(`SELECT ${columnas}, a.token_version FROM webcobro.clientes c JOIN webcobro.clientes_acceso_movil a ON a.cliente_id = c.id WHERE c.id = $1 AND a.password_hash IS NOT NULL`, [payload.sub]);
        const c = r.rows[0];
        if (!c?.activo || c.token_version !== payload.tv) throw fallo(401, 'Sesión inválida o cliente inactivo.');
        res.locals.cliente = c; next();
    }));
    router.get('/me', (_req, res) => res.json(perfilCompartido(res.locals.cliente)));
    router.patch('/me', asyncHandler(async (req, res) => {
        if (req.body?.password !== undefined || req.body?.confirmarPassword !== undefined) throw fallo(400, 'Usa la ruta de cambio de contraseña.');
        let datos: Record<string, unknown>;
        try { datos = normalizarCliente(req.body, true); }
        catch (e) { throw fallo(400, (e as Error).message); }
        const campos = Object.keys(datos);
        if (!campos.length) throw fallo(400, 'No hay cambios para guardar.');
        const r = await pool.query(`UPDATE webcobro.clientes SET ${campos.map((c, i) => `${c} = $${i + 1}`).join(', ')}
            WHERE id = $${campos.length + 1} AND activo = TRUE RETURNING *`, [...Object.values(datos), res.locals.cliente.id]);
        if (!r.rows[0]) throw fallo(409, 'El cliente ya no está activo.');
        res.json(perfilCompartido(r.rows[0]));
    }));
    router.patch('/me/password', limitar, asyncHandler(async (req, res) => {
        const b = req.body ?? {};
        let password: string;
        try { password = validarPassword(b.password, b.confirmarPassword); }
        catch (e) { throw fallo(400, (e as Error).message); }
        if (typeof b.passwordActual !== 'string' || Buffer.byteLength(b.passwordActual) > 72) throw fallo(400, 'Contraseña actual inválida.');
        await transaccion(async db => {
            const r = await db.query('SELECT password_hash FROM webcobro.clientes_acceso_movil WHERE cliente_id = $1 FOR UPDATE', [res.locals.cliente.id]);
            if (!r.rows[0]?.password_hash || !await bcrypt.compare(b.passwordActual, r.rows[0].password_hash)) throw fallo(401, 'La contraseña actual es incorrecta.');
            await db.query('UPDATE webcobro.clientes_acceso_movil SET password_hash = $2, token_version = token_version + 1 WHERE cliente_id = $1', [res.locals.cliente.id, await bcrypt.hash(password, 10)]);
        });
        res.json({ ok: true, requiereLogin: true });
    }));

    router.use(((err: any, _req: any, res: any, _next: any) => {
        if (err.code === '23505') return res.status(409).json({ error: 'Ese correo ya está en uso por otro cliente.' });
        if (err.code === '42P01') return res.status(503).json({ error: 'Falta aplicar la migración de acceso móvil.' });
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Error de clientes compartidos:', err.code ?? err.name);
        res.status(500).json({ error: 'No se pudo completar la operación.' });
    }) as import('express').ErrorRequestHandler);
    return router;
}