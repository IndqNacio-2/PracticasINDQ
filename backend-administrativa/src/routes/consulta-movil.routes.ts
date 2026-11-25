import { Router } from 'express';
import type { Pool } from 'pg';
import { Clase } from '../models/Clases/clases';
import { Horario } from '../models/Horarios/horarios';
import { Membresia } from '../models/Membresia/membresia.model';
import { Usuario } from '../models/Usuarios/usuarios';
import { asyncHandler } from '../lib/asynchandler';

const fallo = (message: string) => Object.assign(new Error(message), { status: 400 });
const objectId = /^[a-f\d]{24}$/i;

function fecha(value: unknown, defecto: string): string {
    if (value === undefined) return defecto;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw fallo('Fecha inválida: usa YYYY-MM-DD.');
    const d = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw fallo('Fecha inválida.');
    return value;
}

function pagina(query: Record<string, unknown>) {
    const entero = (v: unknown, defecto: number, max: number) => {
        if (v === undefined) return defecto;
        if (typeof v !== 'string' || !/^\d+$/.test(v) || Number(v) < 1 || Number(v) > max) throw fallo('Paginación inválida.');
        return Number(v);
    };
    const limite = entero(query.limite, 50, 100);
    return { limite, offset: (entero(query.pagina, 1, 10000) - 1) * limite };
}

// Se monta DESPUÉS de autenticar al cliente. Nunca acepta un clienteId enviado
// por el móvil ni convierte IDs numéricos de PostgreSQL en ObjectId de MongoDB.
export function crearConsultasMovil(pool: Pool) {
    const router = Router();
    router.get('/clases', asyncHandler(async (_req, res) => {
        const clases = await Clase.find({ estatus: 'activo' })
            .select('_id nombre descripcion precio color').sort({ nombre: 1 }).lean();
        res.json(clases.map(c => ({ idClase: String(c._id), nombre: c.nombre, descripcion: c.descripcion, precio: c.precio, color: c.color })));
    }));

    router.get('/horarios', asyncHandler(async (req, res) => {
        const hoy = new Date();
        const local = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        const desde = fecha(req.query.desde, local);
        const hasta = fecha(req.query.hasta, desde);
        const dias = (Date.parse(hasta) - Date.parse(desde)) / 86400000;
        if (dias < 0 || dias > 31) throw fallo('El intervalo debe ser de 0 a 31 días.');
        const filtro: Record<string, unknown> = { estatus: 'activo', visibleReservas: true, fecha: { $gte: desde, $lte: hasta } };
        if (req.query.idClase !== undefined) {
            if (typeof req.query.idClase !== 'string' || !objectId.test(req.query.idClase)) throw fallo('Clase inválida.');
            filtro.idClase = req.query.idClase;
        }
        const { limite, offset } = pagina(req.query);
        const [clases, entrenadores] = await Promise.all([
            Clase.find({ estatus: 'activo' }).select('_id').lean(),
            Usuario.find({ estatus: 'activo', rol: 'entrenador' }).select('_id').lean(),
        ]);
        filtro.idClase = { $in: clases.map(c => String(c._id)).filter(id => !req.query.idClase || id === req.query.idClase) };
        filtro.entrenadorId = { $in: entrenadores.map(e => String(e._id)) };
        const horarios = await Horario.find(filtro)
            .select('_id idClase nombreClase fecha horaInicio horaFin salon capacidadTotal listaEsperaHabilitada')
            .sort({ fecha: 1, horaInicio: 1, _id: 1 }).skip(offset).limit(limite).lean();
        const ocupacion = await pool.query(`SELECT horario_id, COUNT(*)::integer AS ocupados FROM webcobro.reservas
            WHERE horario_id = ANY($1::text[]) AND estado_cupo = 'confirmada'
              AND estado NOT IN ('cancelado', 'no_asistio') GROUP BY horario_id`, [horarios.map(h => String(h._id))]);
        const cupos = new Map(ocupacion.rows.map(r => [r.horario_id, Number(r.ocupados)]));
        res.json(horarios.map(h => ({ idHorario: String(h._id), idClase: h.idClase, nombreClase: h.nombreClase,
            fecha: h.fecha, horaInicio: h.horaInicio, horaFin: h.horaFin, salon: h.salon,
            capacidadTotal: h.capacidadTotal, capacidadDisponible: Math.max(0, h.capacidadTotal - (cupos.get(String(h._id)) ?? 0)),
            listaEsperaHabilitada: h.listaEsperaHabilitada })));
    }));

    router.get('/membresias', asyncHandler(async (_req, res) => {
        const catalogo = await Membresia.find({ estatus: 'activo' }).sort({ nombre: 1 });
        res.json(catalogo.map(m => m.toJSON()));
    }));

    router.get('/membresias/mis-compras', asyncHandler(async (req, res) => {
        const { limite, offset } = pagina(req.query);
        const compras = await pool.query(`SELECT id, catalogo_id AS "idMembresia", opcion_id AS "idOpcion", condiciones,
            to_char(fecha_inicio, 'YYYY-MM-DD') AS "fechaInicio", to_char(fecha_fin, 'YYYY-MM-DD') AS "fechaFin"
            FROM webcobro.membresias_compras WHERE cliente_id = $1 ORDER BY fecha_inicio DESC, id DESC LIMIT $2 OFFSET $3`,
        [res.locals.cliente.id, limite, offset]);
        res.json(compras.rows);
    }));

    router.get('/reservaciones', asyncHandler(async (req, res) => {
        const { limite, offset } = pagina(req.query);
        const reservas = await pool.query(`SELECT id AS "idReservacion", codigo, clase, fecha AS "fechaClase", hora AS "horaClase",
            horario_id AS "idHorario", estado AS estatus, estado_pago AS "estadoPago", estado_cupo AS "estadoCupo",
            precio::float8 AS precio, membresia_compra_id AS "membresiaCompraId"
            FROM webcobro.reservas WHERE cliente_id = $1 ORDER BY fecha DESC, hora DESC, id DESC LIMIT $2 OFFSET $3`,
        [res.locals.cliente.id, limite, offset]);
        res.json(reservas.rows);
    }));
    return router;
}