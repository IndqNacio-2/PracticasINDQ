import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { Reservacion } from '../models/Reservaciones/reservacion';
import { Horario } from '../models/Horarios/horarios';
import { Cliente } from '../models/Clientes/cliente';

const router = Router();

const ESTATUS = ['confirmada', 'pendiente', 'cancelada'] as const;

// GET /api/reservaciones?idCliente=...&idHorario=...&estatus=...
router.get('/', async (req, res) => {
    const { idCliente, idHorario, estatus } = req.query;
    const filtro: Record<string, unknown> = {};
    if (idCliente) filtro.idCliente = idCliente;
    if (idHorario) filtro.idHorario = idHorario;
    if (estatus) filtro.estatus = estatus;

    const reservaciones = await Reservacion.find(filtro).sort({ fechaClase: -1, fechaReservacion: -1 });
    res.json(reservaciones);
});

// POST /api/reservaciones  { idCliente, idHorario }
// El servidor arma el resto (nombre del cliente, clase, entrenador, hora, fecha de la clase),
// valida que el cliente esté activo y que quede lugar, y descuenta la capacidad del horario.
router.post('/', async (req, res) => {
    const { idCliente, idHorario } = req.body ?? {};

    if (!isValidObjectId(idCliente) || !isValidObjectId(idHorario)) {
        return res.status(400).json({ error: 'Cliente y horario son obligatorios' });
    }

    const cliente = await Cliente.findById(idCliente);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    if (String(cliente.estatus) !== 'activo') return res.status(409).json({ error: 'El cliente está inactivo' });

    const horario = await Horario.findById(idHorario);
    if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });

    const duplicada = await Reservacion.findOne({
        idCliente: String(cliente._id),
        idHorario: String(horario._id),
        estatus: { $ne: 'cancelada' },
    });
    if (duplicada) return res.status(409).json({ error: 'El cliente ya tiene una reservación en ese horario' });

    // Descuento atómico: solo si el horario está activo y aún hay lugares
    const reservado = await Horario.findOneAndUpdate(
        { _id: horario._id, estatus: 'activo', capacidadDisponible: { $gt: 0 } },
        { $inc: { capacidadDisponible: -1 } },
        { new: true }
    );
    if (!reservado) return res.status(409).json({ error: 'El horario está inactivo o ya no tiene lugares disponibles' });

    try {
        const nueva = await Reservacion.create({
            idCliente: String(cliente._id),
            nombreCliente: `${cliente.nombre} ${cliente.apellidos}`,
            idHorario: String(horario._id),
            clase: horario.nombreClase,
            entrenador: horario.nombreEntrenador,
            horaClase: `${horario.horaInicio} - ${horario.horaFin}`,
            fechaClase: horario.fecha,
            estatus: 'pendiente',
            asistenciaConfirmada: false,
        });
        res.status(201).json(nueva);
    } catch (err) {
        // Si no se pudo guardar, devolvemos el lugar
        await Horario.updateOne({ _id: horario._id }, { $inc: { capacidadDisponible: 1 } });
        throw err;
    }
});

// PATCH /api/reservaciones/:id  { estatus?, asistenciaConfirmada? }
// Cancelar devuelve el lugar al horario. Una reservación cancelada no se reactiva.
router.patch('/:id', async (req, res) => {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Id de reservación inválido' });

    const reservacion = await Reservacion.findById(req.params.id);
    if (!reservacion) return res.status(404).json({ error: 'Reservación no encontrada' });

    const { estatus, asistenciaConfirmada } = req.body ?? {};
    const cambios: { estatus?: (typeof ESTATUS)[number]; asistenciaConfirmada?: boolean } = {};

    if (estatus !== undefined) {
        if (!ESTATUS.includes(estatus)) return res.status(400).json({ error: 'Estatus inválido' });
        if (reservacion.estatus === 'cancelada' && estatus !== 'cancelada') {
            return res.status(409).json({ error: 'Una reservación cancelada no se puede reactivar; crea una nueva' });
        }
        cambios.estatus = estatus;
    }

    if (asistenciaConfirmada !== undefined) {
        if (typeof asistenciaConfirmada !== 'boolean') {
            return res.status(400).json({ error: 'asistenciaConfirmada debe ser booleano' });
        }
        if ((cambios.estatus ?? reservacion.estatus) === 'cancelada' && asistenciaConfirmada) {
            return res.status(409).json({ error: 'No se puede confirmar asistencia de una reservación cancelada' });
        }
        cambios.asistenciaConfirmada = asistenciaConfirmada;
    }

    const seCancela = cambios.estatus === 'cancelada' && reservacion.estatus !== 'cancelada';

    const actualizada = await Reservacion.findByIdAndUpdate(req.params.id, cambios, { new: true });
    if (seCancela) {
        await Horario.updateOne({ _id: reservacion.idHorario }, { $inc: { capacidadDisponible: 1 } });
    }
    res.json(actualizada);
});

export default router;
