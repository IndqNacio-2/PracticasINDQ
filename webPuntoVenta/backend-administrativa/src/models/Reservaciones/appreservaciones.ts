import { Router, type Request } from 'express';
import { isValidObjectId } from 'mongoose';
import { asyncHandler, manejarErrores } from '../../lib/asynchandler';
import { authCliente, type ClienteRequest } from '../../middleware/authclientes';
import {
    buscarPorCodigo,
    buscarPorId,
    cancelarReservacion,
    crearReservacion,
    listarReservaciones,
    manejarReglas,
    reagendarReservacion,
} from '../../services/reservaciones.service';

// Endpoints de la app móvil para que el cliente gestione SUS reservaciones.
// Montar en /api/app/reservaciones. Aquí las reglas siempre se aplican (no existe `forzar`).
const router = Router();
router.use(authCliente);

router.param('id', (_req, res, next, id) => {
    if (!isValidObjectId(id)) return res.status(400).json({ error: 'ID de reservación inválido' });
    next();
});

const idCliente = (req: Request) => String((req as ClienteRequest).cliente!._id);

// Mis reservaciones. ?estatus= & ?fecha=AAAA-MM-DD
router.get('/', asyncHandler(async (req, res) => {
    res.json(await listarReservaciones({ ...(req.query as Record<string, unknown>), idCliente: idCliente(req) }));
}));

// Consulta por folio (solo si la reservación es del cliente).
router.get('/codigo/:codigo', asyncHandler(async (req, res) => {
    res.json(await buscarPorCodigo(String(req.params.codigo), idCliente(req)));
}));

router.get('/:id', asyncHandler(async (req, res) => {
    res.json(await buscarPorId(String(req.params.id), idCliente(req)));
}));

// Reservar una clase. Body: idHorario, clase, entrenador, horaClase, fechaReservacion.
router.post('/', asyncHandler(async (req, res) => {
    res.status(201).json(await crearReservacion(req.body, idCliente(req)));
}));

// Reagendar (solo una vez, sin costo).
router.patch('/:id/reagendar', asyncHandler(async (req, res) => {
    res.json(await reagendarReservacion(String(req.params.id), req.body, { idCliente: idCliente(req) }));
}));

// Cancelar (hasta 24 h antes, sin reembolso).
router.patch('/:id/cancelar', asyncHandler(async (req, res) => {
    res.json(await cancelarReservacion(String(req.params.id), { idCliente: idCliente(req) }));
}));

router.use(manejarReglas);
router.use(manejarErrores);

export default router;