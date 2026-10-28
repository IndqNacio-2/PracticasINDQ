import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { Horario } from '../models/Horarios/horarios';
import { Clase } from '../models/Clases/clases';
import { Reservacion } from '../models/Reservaciones/reservacion';
import { pool } from '../lib/post';
import { rolDbAApi, type UsuarioRow } from '../lib/usuarios';

const router = Router();

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Devuelve el nombre completo si el id es de un entrenador activo; si no, null
async function nombreEntrenadorActivo(id: string): Promise<string | null> {
    const n = Number(id);
    if (!Number.isInteger(n)) return null;
    const { rows } = await pool.query<Pick<UsuarioRow, 'nombre' | 'apellidos' | 'rol' | 'estatus'>>(
        'SELECT nombre, apellidos, rol, estatus FROM webadministrativa.usuarios WHERE id_usuario = $1',
        [n]
    );
    const u = rows[0];
    if (!u || !u.estatus || rolDbAApi(u.rol) !== 'entrenador') return null;
    return `${u.nombre} ${u.apellidos}`;
}

// ¿El entrenador ya tiene otra clase activa que se empalma con este horario?
async function hayTraslape(entrenadorId: string, fecha: string, inicio: string, fin: string, excluirId?: string) {
    const otros = await Horario.find({
        entrenadorId,
        fecha,
        estatus: 'activo',
        ...(excluirId ? { _id: { $ne: excluirId } } : {}),
    });
    return otros.some((h) => inicio < h.horaFin && fin > h.horaInicio);
}

// GET /api/horarios?fecha=YYYY-MM-DD&estatus=activo
router.get('/', async (req, res) => {
    const { fecha, estatus } = req.query;
    const filtro: Record<string, unknown> = {};
    if (fecha) filtro.fecha = fecha;
    if (estatus) filtro.estatus = estatus;

    const horarios = await Horario.find(filtro).sort({ fecha: 1, horaInicio: 1 });
    res.json(horarios);
});

// POST /api/horarios
// El nombre de la clase y del entrenador los pone el servidor a partir de sus ids.
router.post('/', async (req, res) => {
    const { idClase, entrenadorId, fecha, horaInicio, horaFin, capacidadTotal, salon } = req.body ?? {};

    if (!idClase || !entrenadorId || !fecha || !horaInicio || !horaFin || !capacidadTotal || !salon) {
        return res.status(400).json({ error: 'Faltan datos obligatorios para crear el horario' });
    }
    if (!FECHA.test(fecha) || !HORA.test(horaInicio) || !HORA.test(horaFin) || horaFin <= horaInicio) {
        return res.status(400).json({ error: 'Fecha u horas inválidas (la hora fin debe ser mayor a la de inicio)' });
    }
    const capacidad = Number(capacidadTotal);
    if (!Number.isInteger(capacidad) || capacidad < 1) {
        return res.status(400).json({ error: 'La capacidad debe ser un entero mayor a 0' });
    }
    if (!isValidObjectId(idClase)) return res.status(400).json({ error: 'Clase inválida' });

    const clase = await Clase.findById(idClase);
    if (!clase || clase.estatus !== 'activo') return res.status(404).json({ error: 'Clase no encontrada o inactiva' });

    const nombreEntrenador = await nombreEntrenadorActivo(String(entrenadorId));
    if (!nombreEntrenador) return res.status(404).json({ error: 'Entrenador no encontrado o inactivo' });

    if (await hayTraslape(String(entrenadorId), fecha, horaInicio, horaFin)) {
        return res.status(409).json({ error: 'El entrenador ya tiene otra clase en ese horario' });
    }

    const nuevo = await Horario.create({
        idClase: String(clase._id),
        nombreClase: clase.nombre,
        entrenadorId: String(entrenadorId),
        nombreEntrenador,
        fecha,
        horaInicio,
        horaFin,
        capacidadTotal: capacidad,
        // Al crear, no hay reservaciones: disponible = total
        capacidadDisponible: capacidad,
        salon,
        estatus: req.body.estatus === 'inactivo' ? 'inactivo' : 'activo',
    });

    res.status(201).json(nuevo);
});

// PATCH /api/horarios/:id  (editar horario existente)
router.patch('/:id', async (req, res) => {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Id de horario inválido' });
    const horario = await Horario.findById(req.params.id);
    if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });

    const b = req.body ?? {};
    const cambios: Record<string, unknown> = {};

    if (b.idClase !== undefined && b.idClase !== horario.idClase) {
        if (!isValidObjectId(b.idClase)) return res.status(400).json({ error: 'Clase inválida' });
        const clase = await Clase.findById(b.idClase);
        if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });
        cambios.idClase = String(clase._id);
        cambios.nombreClase = clase.nombre;
    }

    if (b.entrenadorId !== undefined && String(b.entrenadorId) !== horario.entrenadorId) {
        const nombre = await nombreEntrenadorActivo(String(b.entrenadorId));
        if (!nombre) return res.status(404).json({ error: 'Entrenador no encontrado o inactivo' });
        cambios.entrenadorId = String(b.entrenadorId);
        cambios.nombreEntrenador = nombre;
    }

    for (const campo of ['fecha', 'horaInicio', 'horaFin', 'salon'] as const) {
        if (b[campo] !== undefined) cambios[campo] = b[campo];
    }
    if (b.estatus === 'activo' || b.estatus === 'inactivo') cambios.estatus = b.estatus;

    const fecha = String(cambios.fecha ?? horario.fecha);
    const horaInicio = String(cambios.horaInicio ?? horario.horaInicio);
    const horaFin = String(cambios.horaFin ?? horario.horaFin);
    if (!FECHA.test(fecha) || !HORA.test(horaInicio) || !HORA.test(horaFin) || horaFin <= horaInicio) {
        return res.status(400).json({ error: 'Fecha u horas inválidas (la hora fin debe ser mayor a la de inicio)' });
    }

    const entrenadorId = String(cambios.entrenadorId ?? horario.entrenadorId);
    const estatusFinal = String(cambios.estatus ?? horario.estatus);
    if (
        estatusFinal === 'activo' &&
        (await hayTraslape(entrenadorId, fecha, horaInicio, horaFin, String(horario._id)))
    ) {
        return res.status(409).json({ error: 'El entrenador ya tiene otra clase en ese horario' });
    }

    // La capacidad disponible = nueva capacidad total − reservaciones vigentes.
    // Así editar la capacidad no borra el conteo de lugares ya reservados.
    if (b.capacidadTotal !== undefined) {
        const capacidad = Number(b.capacidadTotal);
        if (!Number.isInteger(capacidad) || capacidad < 1) {
            return res.status(400).json({ error: 'La capacidad debe ser un entero mayor a 0' });
        }
        const activas = await Reservacion.countDocuments({
            idHorario: String(horario._id),
            estatus: { $ne: 'cancelada' },
        });
        if (capacidad < activas) {
            return res.status(409).json({ error: `Ya hay ${activas} reservaciones; la capacidad no puede ser menor` });
        }
        cambios.capacidadTotal = capacidad;
        cambios.capacidadDisponible = capacidad - activas;
    }

    const actualizado = await Horario.findByIdAndUpdate(req.params.id, cambios, { new: true });
    res.json(actualizado);
});

export default router;
