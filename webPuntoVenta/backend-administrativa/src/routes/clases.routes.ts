import { Router } from 'express';
import { Clase } from '../models/Clases/clases';
import { validarClase } from '../lib/validacion-clases';
import { esObjectId } from '../lib/validacion';

const router = Router();

// GET /api/clases
router.get('/', async (_req, res) => {
    const clases = await Clase.find().sort({ nombre: 1 });
    res.json(clases);
});

// POST /api/clases
router.post('/', async (req, res) => {
    if (req.body?.entrenadorId !== undefined) {
        return res.status(400).json({ error: 'El entrenador se asigna en la programacion semanal o en la sesion, no en el catalogo de clases.' });
    }
    const error = validarClase(req.body);
    if (error) return res.status(400).json({ error });

    // La clase es solo el catalogo (nombre, capacidad, precio, color...). Ya NO
    // tiene hora fija: la fecha y el intervalo (horaInicio/horaFin) viven en
    // los HORARIOS, que son los que evitan los solapamientos del entrenador.
    const nueva = await Clase.create({ ...req.body, nombre: req.body.nombre.trim() });
    res.status(201).json(nueva);
});

// PATCH /api/clases/:id  (editar y también togglear estatus)
router.patch('/:id', async (req, res) => {
    if (req.body?.entrenadorId !== undefined) {
        return res.status(400).json({ error: 'El entrenador se asigna en la programacion semanal o en la sesion, no en el catalogo de clases.' });
    }
    if (!esObjectId(req.params.id)) return res.status(400).json({ error: 'El identificador de la clase no es válido.' });
    const error = validarClase(req.body, true);
    if (error) return res.status(400).json({ error });
    const cambios = { ...req.body };
    if (cambios.nombre !== undefined) cambios.nombre = cambios.nombre.trim();
    const clase = await Clase.findByIdAndUpdate(req.params.id, cambios, { new: true, runValidators: true });
    if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });
    res.json(clase);
});

export default router;