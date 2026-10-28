import { Router } from 'express';
import { Clase } from '../models/clase';
import { fechaLocal } from '../lib/fecha';
import { paqueteCubre, precioClase, type MembresiaDoc } from '../lib/reglas';
import { precioPorDefecto } from '../lib/vista';

const router = Router();

// GET /api/clases — tipos de clase activos (para los filtros "Todas / Pilates / Yoga")
router.get('/', async (_req, res) => {
    const membresia = res.locals.cliente.membresia as MembresiaDoc | null;
    const hoy = fechaLocal();
    const clases = await Clase.find({ estatus: 'activo' }).sort({ nombre: 1 });

    res.json(
        clases.map((c) => ({
            idClase: String(c._id),
            nombre: c.nombre,
            descripcion: c.descripcion ?? '',
            color: c.color ?? '',
            precio: precioClase(c.precio, precioPorDefecto()),
            incluidaEnPaquete: paqueteCubre(membresia, c.nombre, hoy),
        }))
    );
});

export default router;
