import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../lib/post';
import { requireRole } from '../middleware/auth';
import {
    COLUMNAS_USUARIO,
    ROLES_API,
    rolApiADb,
    rolDbAApi,
    toPublico,
    validarCelular,
    validarFechaNacimiento,
    validarFoto,
    validarFormaciones,
    MAX_RESUMEN,
    type RolApi,
    type UsuarioRow,
} from '../lib/usuarios';

const router = Router();
const soloAdmin = requireRole(rolApiADb('administrador'));

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const esRol = (v: unknown): v is RolApi => typeof v === 'string' && (ROLES_API as string[]).includes(v);

// Valida los campos del perfil profesional (solo entrenadores). Devuelve un objeto { columna: valor }
// con lo que venga en el body, o un mensaje de error. La foto la tienen todos los usuarios y se valida aparte.
function perfilEntrenador(b: Record<string, unknown>): { ok: true; cambios: Record<string, unknown> } | { ok: false; error: string } {
    const cambios: Record<string, unknown> = {};

    if (b.resumen !== undefined) {
        const r = String(b.resumen ?? '').trim();
        if (r.length > MAX_RESUMEN) return { ok: false, error: `El resumen admite máximo ${MAX_RESUMEN} caracteres` };
        cambios.resumen = r || null;
    }
    if (b.capacitaciones !== undefined) {
        const c = validarFormaciones(b.capacitaciones, 'Capacitaciones');
        if (!c.ok) return c;
        cambios.capacitaciones = JSON.stringify(c.valor);
    }
    if (b.certificaciones !== undefined) {
        const c = validarFormaciones(b.certificaciones, 'Certificaciones');
        if (!c.ok) return c;
        cambios.certificaciones = JSON.stringify(c.valor);
    }
    return { ok: true, cambios };
}

// GET /api/usuarios?rol=entrenador&estatus=activo
// Lo usan también los selects (entrenadores) de clases y horarios, por eso basta con estar autenticado.
router.get('/', async (req, res) => {
    const condiciones: string[] = [];
    const valores: unknown[] = [];

    if (esRol(req.query.rol)) {
        valores.push(rolApiADb(req.query.rol));
        condiciones.push(`rol = $${valores.length}`);
    }
    if (req.query.estatus === 'activo' || req.query.estatus === 'inactivo') {
        valores.push(req.query.estatus === 'activo');
        condiciones.push(`estatus = $${valores.length}`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await pool.query<UsuarioRow>(
        `SELECT ${COLUMNAS_USUARIO} FROM webadministrativa.usuarios ${where} ORDER BY nombre, apellidos`,
        valores
    );
    res.json(rows.map((u) => toPublico(u)));
});

// GET /api/usuarios/:id  (solo administrador) — incluye el contenido de los documentos de capacitaciones y certificaciones
router.get('/:id', soloAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id de usuario inválido' });
    const { rows } = await pool.query<UsuarioRow>(
        `SELECT ${COLUMNAS_USUARIO} FROM webadministrativa.usuarios WHERE id_usuario = $1`,
        [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(toPublico(rows[0], true));
});

// POST /api/usuarios  (solo administrador)
router.post('/', soloAdmin, async (req, res) => {
    const { nombre, apellidos, correo, telefono, fechaNacimiento, rol, password, confirmarPassword, especialidad, turnoEntrada, turnoSalida } = req.body ?? {};

    if (!nombre || !apellidos || !correo || !esRol(rol)) {
        return res.status(400).json({ error: 'Nombre, apellidos, correo y rol válido son obligatorios' });
    }
    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'La contraseña es obligatoria y debe tener al menos 8 caracteres' });
    }
    if (confirmarPassword !== undefined && confirmarPassword !== password) {
        return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }
    const nac = validarFechaNacimiento(fechaNacimiento);
    if (!nac.ok) return res.status(400).json({ error: nac.error });
    const cel = validarCelular(telefono);
    if (!cel.ok) return res.status(400).json({ error: cel.error });
    for (const t of [turnoEntrada, turnoSalida]) {
        if (t && !HORA.test(t)) return res.status(400).json({ error: 'Los turnos deben tener formato HH:MM' });
    }

    // La foto la puede tener cualquier usuario
    const f = validarFoto(req.body?.foto);
    if (!f.ok) return res.status(400).json({ error: f.error });

    // Resumen, capacitaciones y certificaciones solo aplican a entrenadores
    let perfil: Record<string, unknown> = {};
    if (rol === 'entrenador') {
        const p = perfilEntrenador(req.body);
        if (!p.ok) return res.status(400).json({ error: p.error });
        perfil = p.cambios;
    }

    const correoNorm = String(correo).trim().toLowerCase();

    const duplicado = await pool.query('SELECT 1 FROM webadministrativa.usuarios WHERE correo = $1', [correoNorm]);
    if (duplicado.rowCount) {
        return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }

    const { rows } = await pool.query<UsuarioRow>(
        `INSERT INTO webadministrativa.usuarios
           (nombre, apellidos, correo, telefono, fecha_nacimiento, rol, estatus, especialidad, turno_entrada, turno_salida,
            foto, resumen, capacitaciones, certificaciones, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14)
         RETURNING ${COLUMNAS_USUARIO}`,
        [
            String(nombre).trim(),
            String(apellidos).trim(),
            correoNorm,
            cel.valor,
            nac.valor,
            rolApiADb(rol),
            especialidad || null,
            turnoEntrada || null,
            turnoSalida || null,
            f.valor || null,
            perfil.resumen ?? null,
            perfil.capacitaciones ?? '[]',
            perfil.certificaciones ?? '[]',
            bcrypt.hashSync(password, 10),
        ]
    );
    res.status(201).json(toPublico(rows[0]));
});

// PATCH /api/usuarios/:id  (solo administrador) — editar y baja/alta lógica (estatus)
router.patch('/:id', soloAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id de usuario inválido' });

    const b = req.body ?? {};
    const sets: string[] = [];
    const valores: unknown[] = [];
    const agregar = (columna: string, valor: unknown) => {
        valores.push(valor);
        sets.push(`${columna} = $${valores.length}`);
    };

    if (b.nombre !== undefined) agregar('nombre', String(b.nombre).trim());
    if (b.apellidos !== undefined) agregar('apellidos', String(b.apellidos).trim());
    if (b.telefono !== undefined) {
        const cel = validarCelular(b.telefono);
        if (!cel.ok) return res.status(400).json({ error: cel.error });
        agregar('telefono', cel.valor);
    }
    if (b.fechaNacimiento !== undefined) {
        const nac = validarFechaNacimiento(b.fechaNacimiento);
        if (!nac.ok) return res.status(400).json({ error: nac.error });
        agregar('fecha_nacimiento', nac.valor);
    }
    if (b.foto !== undefined) {
        const f = validarFoto(b.foto);
        if (!f.ok) return res.status(400).json({ error: f.error });
        agregar('foto', f.valor || null);
    }
    if (b.especialidad !== undefined) agregar('especialidad', b.especialidad || null);

    for (const [campo, columna] of [['turnoEntrada', 'turno_entrada'], ['turnoSalida', 'turno_salida']] as const) {
        if (b[campo] !== undefined) {
            if (b[campo] && !HORA.test(b[campo])) {
                return res.status(400).json({ error: 'Los turnos deben tener formato HH:MM' });
            }
            agregar(columna, b[campo] || null);
        }
    }

    if (b.rol !== undefined) {
        if (!esRol(b.rol)) return res.status(400).json({ error: 'Rol inválido' });
        agregar('rol', rolApiADb(b.rol));
    }

    if (b.estatus !== undefined) {
        if (b.estatus !== 'activo' && b.estatus !== 'inactivo') {
            return res.status(400).json({ error: 'Estatus inválido' });
        }
        if (b.estatus === 'inactivo' && id === req.auth!.id) {
            return res.status(409).json({ error: 'No puedes dar de baja tu propia cuenta' });
        }
        agregar('estatus', b.estatus === 'activo');
    }

    if (b.correo !== undefined) {
        const correo = String(b.correo).trim().toLowerCase();
        const enUso = await pool.query(
            'SELECT 1 FROM webadministrativa.usuarios WHERE correo = $1 AND id_usuario <> $2',
            [correo, id]
        );
        if (enUso.rowCount) return res.status(409).json({ error: 'Ese correo ya está en uso por otro usuario' });
        agregar('correo', correo);
    }

    // Perfil profesional (resumen, capacitaciones, certificaciones): solo se guarda si el usuario es (o pasa a ser) entrenador
    const tocaPerfil = ['resumen', 'capacitaciones', 'certificaciones'].some((k) => b[k] !== undefined);
    if (tocaPerfil) {
        let rolFinal: RolApi | undefined = esRol(b.rol) ? b.rol : undefined;
        if (!rolFinal) {
            const actual = await pool.query<{ rol: string }>(
                'SELECT rol FROM webadministrativa.usuarios WHERE id_usuario = $1',
                [id]
            );
            if (!actual.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
            rolFinal = rolDbAApi(actual.rows[0].rol);
        }
        if (rolFinal === 'entrenador') {
            const p = perfilEntrenador(b);
            if (!p.ok) return res.status(400).json({ error: p.error });
            for (const [columna, valor] of Object.entries(p.cambios)) {
                agregar(columna, valor);
                // las listas viajan como texto JSON y la columna es jsonb
                if (columna === 'capacitaciones' || columna === 'certificaciones') {
                    sets[sets.length - 1] = `${columna} = $${valores.length}::jsonb`;
                }
            }
        }
    }

    // Contraseña opcional al editar: solo se cambia si viene con valor
    if (typeof b.password === 'string' && b.password) {
        if (b.confirmarPassword !== undefined && b.confirmarPassword !== b.password) {
            return res.status(400).json({ error: 'Las contraseñas no coinciden' });
        }
        if (b.password.length < 8) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
        }
        agregar('password_hash', bcrypt.hashSync(b.password, 10));
    }

    if (sets.length === 0) return res.status(400).json({ error: 'No hay cambios que guardar' });

    valores.push(id);
    const { rows } = await pool.query<UsuarioRow>(
        `UPDATE webadministrativa.usuarios SET ${sets.join(', ')}
         WHERE id_usuario = $${valores.length}
         RETURNING ${COLUMNAS_USUARIO}`,
        valores
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json(toPublico(rows[0]));
});

export default router;