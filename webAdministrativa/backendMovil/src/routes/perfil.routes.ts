import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Cliente } from '../models/cliente';
import { perfilPublico } from '../lib/vista';
import { validarCelular, validarFoto, validarPassword } from '../lib/validar';

const router = Router();

// GET /api/me — datos del encabezado (nombre, iniciales, foto) y la membresía con el aro de clases
router.get('/', (_req, res) => {
    res.json(perfilPublico(res.locals.cliente));
});

// PATCH /api/me  { telefono?, foto?, direccion? }
router.patch('/', async (req, res) => {
    const cliente = res.locals.cliente;
    const b = req.body ?? {};

    if (b.telefono !== undefined) {
        const t = validarCelular(b.telefono);
        if (!t.ok) return res.status(400).json({ error: t.error });
        cliente.telefono = t.valor;
    }
    if (b.foto !== undefined) {
        const f = validarFoto(b.foto);
        if (!f.ok) return res.status(400).json({ error: f.error });
        cliente.avatar = f.valor || undefined;
    }
    if (b.direccion !== undefined) {
        const d = String(b.direccion ?? '').trim();
        if (d.length > 200) return res.status(400).json({ error: 'La dirección admite máximo 200 caracteres' });
        cliente.direccion = d;
    }

    await cliente.save();
    res.json(perfilPublico(cliente));
});

// PATCH /api/me/password  { passwordActual, password, confirmarPassword }
router.patch('/password', async (req, res) => {
    const conHash = await Cliente.findById(res.locals.cliente._id).select('+passwordHash');
    if (!conHash?.passwordHash || typeof req.body?.passwordActual !== 'string' ||
        !bcrypt.compareSync(req.body.passwordActual, conHash.passwordHash)) {
        return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }
    const nueva = validarPassword(req.body?.password, req.body?.confirmarPassword);
    if (!nueva.ok) return res.status(400).json({ error: nueva.error });

    conHash.passwordHash = bcrypt.hashSync(nueva.valor, 10);
    await conHash.save();
    res.json({ ok: true });
});

export default router;
