import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { Clase } from '../models/Clases/clases';
import { esEnteroPositivo, esTextoNoVacio } from '../lib/validacion';

// Catálogo de clases (nombre, capacidad, precio, color). Los horarios y la
// programación semanal toman de aquí el idClase, el nombre y la capacidad máxima.
const router = Router();

const COLOR_HEX = /^#[0-9a-fA-F]{6}$/;

router.param('id', (_req, res, next, id) => {
    if (!isValidObjectId(id)) return res.status(400).json({ error: 'El identificador de la clase no es valido.' });
    next();
});

const esObjeto = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);

// GET /api/clases?estatus=activo|inactivo
router.get('/', async (req, res) => {
    const filtro: any = {};
    if (req.query.estatus === 'activo' || req.query.estatus === 'inactivo') filtro.estatus = req.query.estatus;
    const clases: any[] = await Clase.find(filtro as any).sort({ nombre: 1 });
    res.json(clases.map((c) => c.toJSON()));
});

// GET /api/clases/:id
router.get('/:id', async (req, res) => {
    const clase: any = await Clase.findById(req.params.id);
    if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });
    res.json(clase.toJSON());
});

// Valida los campos que vengan en el body. En modo parcial (PATCH) solo revisa los presentes.
function normalizarClase(b: any, parcial: boolean): { error: string } | { datos: any } {
    const datos: any = {};

    if (!parcial || b.nombre !== undefined) {
        if (!esTextoNoVacio(b.nombre)) return { error: 'El nombre de la clase es obligatorio.' };
        datos.nombre = b.nombre.trim();
    }
    if (b.descripcion !== undefined) datos.descripcion = String(b.descripcion ?? '').trim();

    if (!parcial || b.capacidad !== undefined) {
        if (!esEnteroPositivo(b.capacidad)) return { error: 'La capacidad debe ser un numero entero mayor que 0.' };
        datos.capacidad = Number(b.capacidad);
    }
    if (b.precio !== undefined) {
        const precio = Number(b.precio);
        if (!Number.isFinite(precio) || precio < 0) return { error: 'El precio no puede ser negativo.' };
        datos.precio = precio;
    }
    if (b.color !== undefined) {
        if (typeof b.color !== 'string' || !COLOR_HEX.test(b.color)) return { error: 'El color debe tener formato #RRGGBB.' };
        datos.color = b.color;
    }
    if (b.estatus !== undefined) {
        if (b.estatus !== 'activo' && b.estatus !== 'inactivo') return { error: "El estatus debe ser 'activo' o 'inactivo'." };
        datos.estatus = b.estatus;
    }
    if (b.entrenadorId !== undefined) datos.entrenadorId = String(b.entrenadorId ?? '');

    return { datos };
}

// POST /api/clases
router.post('/', async (req, res) => {
    if (!esObjeto(req.body)) return res.status(400).json({ error: 'El cuerpo de la peticion debe ser un objeto JSON.' });
    const r = normalizarClase(req.body, false);
    if ('error' in r) return res.status(400).json({ error: r.error });

    const creada: any = await Clase.create(r.datos);
    res.status(201).json(creada.toJSON());
});

// PATCH /api/clases/:id  (edición y baja/alta lógica con { estatus })
router.patch('/:id', async (req, res) => {
    if (!esObjeto(req.body)) return res.status(400).json({ error: 'El cuerpo de la peticion debe ser un objeto JSON.' });
    const r = normalizarClase(req.body, true);
    if ('error' in r) return res.status(400).json({ error: r.error });
    if (Object.keys(r.datos).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });

    const actualizada: any = await Clase.findByIdAndUpdate(req.params.id, { $set: r.datos }, { new: true, runValidators: true });
    if (!actualizada) return res.status(404).json({ error: 'Clase no encontrada' });
    res.json(actualizada.toJSON());
});

// Las clases no se eliminan: tienen horarios y reservaciones asociados.
router.delete('/:id', (_req, res) => {
    res.status(405).json({ error: 'Las clases no se eliminan. Usa PATCH /:id con { "estatus": "inactivo" }.' });
});

export default router;