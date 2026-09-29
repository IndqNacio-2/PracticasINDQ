import { Router } from 'express';
import { Reservacion } from '../models/Reservaciones/reservacion';

const router = Router();

// GET /api/reservaciones?idCliente=...&idHorario=...&estatus=...
router.get('/', async (req, res) => {
    const { idCliente, idHorario, estatus } = req.query;
    const filtro: Record<string, unknown> = {};
    if (idCliente) filtro.idCliente = idCliente;
    if (idHorario) filtro.idHorario = idHorario;
    if (estatus) filtro.estatus = estatus;

    const reservaciones = await Reservacion.find(filtro).sort({ fechaReservacion: -1 });
    res.json(reservaciones);
});

// POST /api/reservaciones
// El front arma el payload completo (nombreCliente, clase, entrenador, horaClase, fechaReservacion)
// a partir del cliente y horario seleccionados, y lo manda tal cual.
router.post('/', async (req, res) => {
    const { idCliente, idHorario, clase, entrenador, horaClase, fechaReservacion, nombreCliente } = req.body;

    if (!idCliente || !idHorario || !clase || !entrenador || !horaClase || !fechaReservacion || !nombreCliente) {
        return res.status(400).json({ error: 'Faltan datos obligatorios para crear la reservación' });
    }

    const nueva = await Reservacion.create({
        ...req.body,
        estatus: req.body.estatus ?? 'pendiente',
        asistenciaConfirmada: req.body.asistenciaConfirmada ?? false,
    });

    res.status(201).json(nueva);
});

// PATCH /api/reservaciones/:id
// Usado para cambiar estatus (confirmar/cancelar) y/o confirmar asistencia.
router.patch('/:id', async (req, res) => {
    const reservacion = await Reservacion.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!reservacion) return res.status(404).json({ error: 'Reservación no encontrada' });
    res.json(reservacion);
});

export default router;