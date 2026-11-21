import { Router } from 'express';
import { Clase } from '../models/clase';
import { fechaLocal } from '../lib/fecha';
import { precioClase } from '../lib/reglas';
import { carteraDe, infoParaClase } from '../lib/membresia';
import { precioPorDefecto } from '../lib/vista';

const router = Router();

// GET /api/clases — tipos de clase activos (para los filtros "Todas / Pilates / Yoga")
router.get('/', async (_req, res) => {
    const cartera = await carteraDe(String(res.locals.cliente._id));
    const hoy = fechaLocal();
    const clases = await Clase.find({ estatus: 'activo' }).sort({ nombre: 1 });

    res.json(
        clases.map((c) => ({
            idClase: String(c._id),
            nombre: c.nombre,
            descripcion: c.descripcion ?? '',
            color: c.color ?? '',
            precio: precioClase(c.precio, precioPorDefecto()),
            incluidaEnPaquete: infoParaClase(cartera, String(c._id), hoy).cubre,
        }))
    );
});

export default router;
