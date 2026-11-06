import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { isValidObjectId } from 'mongoose';
import { Usuario, MAX_RESUMEN, type UserRole } from '../models/Usuarios/usuarios';
import { validarFoto } from '../lib/foto-usuario';
import { validarFormaciones } from '../lib/usuarios';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const ROLES: UserRole[] = ['administrador', 'entrenador', 'recepcion', 'vendedor'];
const esRol = (v: unknown): v is UserRole => typeof v === 'string' && (ROLES as string[]).includes(v);

const MIN_PASSWORD = 3; // igual que el formulario del frontend

// CAUSA DEL 403: antes ninguna ruta de este archivo pasaba por requireAuth, así que
// req.auth quedaba vacío y requireRole siempre respondía "No tienes permiso".
// Ahora todo el router exige token válido.
router.use(requireAuth);

const soloAdmin = requireRole('administrador');

// Mensaje claro cuando Mongo rechaza un valor único (correo o código de acceso repetido).
function errorDuplicado(err: any): string | null {
    if (err?.code !== 11000) return null;
    if (err?.keyPattern?.correo) return 'Ya existe un usuario con ese correo';
    if (err?.keyPattern?.codigoAcceso) return 'Ya existe un usuario con ese código de acceso';
    return 'Ya existe un usuario con esos datos';
}

// GET /api/usuarios?rol=entrenador&estatus=activo
// Lo usan también los selects de clases y horarios (entrenadores): basta con estar autenticado.
router.get('/', async (req, res) => {
    const filtro: any = {};
    if (esRol(req.query.rol)) filtro.rol = req.query.rol;
    if (req.query.estatus === 'activo' || req.query.estatus === 'inactivo') filtro.estatus = req.query.estatus;

    const usuarios: any[] = await Usuario.find(filtro as any).sort({ nombre: 1, apellidos: 1 });
    res.json(usuarios.map((u) => u.toJSON()));
});

// GET /api/usuarios/:id  (solo administrador)
router.get('/:id', soloAdmin, async (req, res) => {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Id de usuario inválido' });
    const usuario: any = await Usuario.findById(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario.toJSON());
});

// POST /api/usuarios  (solo administrador)
router.post('/', soloAdmin, async (req, res) => {
    const b = req.body ?? {};
    const { nombre, apellidos, correo, telefono, codigoAcceso, rol, estatus, password, confirmarPassword } = b;

    if (!nombre || !apellidos || !correo || !codigoAcceso || !esRol(rol)) {
        return res.status(400).json({ error: 'Nombre, apellidos, correo, código de acceso y rol válido son obligatorios' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
        return res.status(400).json({ error: `La contraseña es obligatoria (mínimo ${MIN_PASSWORD} caracteres)` });
    }
    if (confirmarPassword !== undefined && confirmarPassword !== password) {
        return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }
    if (estatus !== undefined && estatus !== 'activo' && estatus !== 'inactivo') {
        return res.status(400).json({ error: 'Estatus inválido' });
    }

    const f = validarFoto(b.foto);
    if (!f.ok) return res.status(400).json({ error: f.error });

    const datos: any = {
        nombre: String(nombre).trim(),
        apellidos: String(apellidos).trim(),
        correo: String(correo).trim().toLowerCase(),
        telefono: telefono ? String(telefono).trim() : '',
        codigoAcceso: String(codigoAcceso).trim().toUpperCase(),
        rol,
        estatus: estatus ?? 'activo',
        foto: f.valor ?? '',
        password: bcrypt.hashSync(password, 10),
    };

    // Resumen, capacitaciones y certificaciones solo aplican a entrenadores.
    if (rol === 'entrenador') {
        if (b.resumen !== undefined) {
            const r = String(b.resumen ?? '').trim();
            if (r.length > MAX_RESUMEN) return res.status(400).json({ error: `El resumen admite máximo ${MAX_RESUMEN} caracteres` });
            datos.resumen = r;
        }
        for (const [campo, etiqueta] of [['capacitaciones', 'Capacitaciones'], ['certificaciones', 'Certificaciones']] as const) {
            if (b[campo] !== undefined) {
                const v = validarFormaciones(b[campo], etiqueta);
                if (!v.ok) return res.status(400).json({ error: v.error });
                datos[campo] = v.valor;
            }
        }
    }

    try {
        const creado: any = await Usuario.create(datos);
        res.status(201).json(creado.toJSON());
    } catch (err: any) {
        const dup = errorDuplicado(err);
        if (dup) return res.status(409).json({ error: dup });
        if (err?.name === 'ValidationError') return res.status(400).json({ error: err.message });
        throw err;
    }
});

// PATCH /api/usuarios/:id  (solo administrador) — editar y baja/alta lógica (estatus)
router.patch('/:id', soloAdmin, async (req, res) => {
    const id = req.params.id;
    if (!isValidObjectId(id)) return res.status(400).json({ error: 'Id de usuario inválido' });

    const b = req.body ?? {};
    const cambios: any = {};

    if (b.nombre !== undefined) cambios.nombre = String(b.nombre).trim();
    if (b.apellidos !== undefined) cambios.apellidos = String(b.apellidos).trim();
    if (b.correo !== undefined) cambios.correo = String(b.correo).trim().toLowerCase();
    if (b.telefono !== undefined) cambios.telefono = b.telefono ? String(b.telefono).trim() : '';
    if (b.codigoAcceso !== undefined) cambios.codigoAcceso = String(b.codigoAcceso).trim().toUpperCase();

    if (b.foto !== undefined) {
        const f = validarFoto(b.foto);
        if (!f.ok) return res.status(400).json({ error: f.error });
        cambios.foto = f.valor ?? '';
    }

    if (b.rol !== undefined) {
        if (!esRol(b.rol)) return res.status(400).json({ error: 'Rol inválido' });
        cambios.rol = b.rol;
    }

    if (b.estatus !== undefined) {
        if (b.estatus !== 'activo' && b.estatus !== 'inactivo') {
            return res.status(400).json({ error: 'Estatus inválido' });
        }
        if (b.estatus === 'inactivo' && id === req.auth!.id) {
            return res.status(409).json({ error: 'No puedes dar de baja tu propia cuenta' });
        }
        cambios.estatus = b.estatus;
    }

    // Perfil profesional: solo si el usuario es (o pasa a ser) entrenador.
    const tocaPerfil = ['resumen', 'capacitaciones', 'certificaciones'].some((k) => b[k] !== undefined);
    if (tocaPerfil) {
        let rolFinal: string | undefined = cambios.rol as string | undefined;
        if (!rolFinal) {
            const actual: any = await Usuario.findById(id).select('rol');
            if (!actual) return res.status(404).json({ error: 'Usuario no encontrado' });
            rolFinal = actual.rol;
        }
        if (rolFinal === 'entrenador') {
            if (b.resumen !== undefined) {
                const r = String(b.resumen ?? '').trim();
                if (r.length > MAX_RESUMEN) return res.status(400).json({ error: `El resumen admite máximo ${MAX_RESUMEN} caracteres` });
                cambios.resumen = r;
            }
            for (const [campo, etiqueta] of [['capacitaciones', 'Capacitaciones'], ['certificaciones', 'Certificaciones']] as const) {
                if (b[campo] !== undefined) {
                    const v = validarFormaciones(b[campo], etiqueta);
                    if (!v.ok) return res.status(400).json({ error: v.error });
                    cambios[campo] = v.valor;
                }
            }
        }
    }

    // Contraseña opcional al editar: solo se cambia si viene con valor.
    if (typeof b.password === 'string' && b.password) {
        if (b.confirmarPassword !== undefined && b.confirmarPassword !== b.password) {
            return res.status(400).json({ error: 'Las contraseñas no coinciden' });
        }
        if (b.password.length < MIN_PASSWORD) {
            return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres` });
        }
        cambios.password = bcrypt.hashSync(b.password, 10);
    }

    if (Object.keys(cambios).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar' });

    try {
        const actualizado: any = await Usuario.findByIdAndUpdate(id, { $set: cambios }, { new: true, runValidators: true });
        if (!actualizado) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(actualizado.toJSON());
    } catch (err: any) {
        const dup = errorDuplicado(err);
        if (dup) return res.status(409).json({ error: dup });
        if (err?.name === 'ValidationError') return res.status(400).json({ error: err.message });
        throw err;
    }
});

export default router;