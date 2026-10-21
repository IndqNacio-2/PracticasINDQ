import { Router } from 'express';
import { Horario } from '../models/Horarios/horarios';

const router = Router();

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
router.post('/', async (req, res) => {
    const { idClase, nombreClase, entrenadorId, nombreEntrenador, fecha, horaInicio, horaFin, capacidadTotal, salon } = req.body;

    if (!idClase || !fecha || !horaInicio || !horaFin || !capacidadTotal || !salon) {
        return res.status(400).json({ error: 'Faltan datos obligatorios para crear el horario' });
    }

    const nuevo = await Horario.create({
        idClase,
        nombreClase,
        entrenadorId,
        nombreEntrenador,
        fecha,
        horaInicio,
        horaFin,
        capacidadTotal,
        // Al crear, la capacidad disponible arranca igual a la total
        capacidadDisponible: capacidadTotal,
        salon,
        estatus: req.body.estatus ?? 'activo',
    });

    res.status(201).json(nuevo);
});

// PATCH /api/horarios/:id  (editar horario existente)
router.patch('/:id', async (req, res) => {
    const cambios = { ...req.body };

    // Si se edita la capacidad total, la disponible se reinicia igual a la nueva total
    // (igual que hacía el front en memoria: capacidadDisponible: Number(form.capacidadTotal))
    if (cambios.capacidadTotal !== undefined) {
        cambios.capacidadDisponible = cambios.capacidadTotal;
    }

    const horario = await Horario.findByIdAndUpdate(req.params.id, cambios, { new: true });
    if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });
    res.json(horario);
});

export default router;