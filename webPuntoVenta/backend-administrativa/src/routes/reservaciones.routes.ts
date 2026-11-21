import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { asyncHandler, manejarErrores } from '../lib/asynchandler';
import {
    buscarPorCodigo,
    buscarPorId,
    cambiarEstatus,
    cancelarReservacion,
    crearReservacion,
    listarReservaciones,
    manejarReglas,
    marcarAsistencia,
    marcarInasistencia,
    reagendarReservacion,
    registrarPago,
} from '../services/reservaciones.service';

// Rutas de la plataforma web (staff). Móntalas detrás de tu middleware de autenticación de administrador.
// Reglas (24 h para cancelar, reagendar una sola vez, inasistencia) en services/reservaciones.service.ts.
// El personal puede enviar { "forzar": true } en cancelar/reagendar para saltarse esas reglas.
const router = Router();

router.param('id', (_req, res, next, id) => {
    if (!isValidObjectId(id)) return res.status(400).json({ error: 'ID de reservación inválido' });
    next();
});

const forzar = (body: any) => body?.forzar === true;

// Consulta: ?idCliente= & ?idHorario= & ?estatus= & ?codigo= & ?fecha=AAAA-MM-DD (día de la clase)
//           & ?tipo=cliente|visitante & ?estadoPago=pendiente|pagado & ?membresiaCompraId=
router.get('/', asyncHandler(async (req, res) => {
    res.json(await listarReservaciones(req.query as Record<string, unknown>));
}));

// Consulta por folio.
router.get('/codigo/:codigo', asyncHandler(async (req, res) => {
    res.json(await buscarPorCodigo(String(req.params.codigo)));
}));

router.get('/:id', asyncHandler(async (req, res) => {
    res.json(await buscarPorId(String(req.params.id)));
}));

// Alta. Body: idHorario (la clase, la hora y la fecha salen del horario) y
//   - cliente registrado: idCliente (el nombre se toma de su registro), o
//   - visitante: tipo = "visitante" + nombreCliente.
// Opcionales: origen ("recepcion" | "app"), membresiaCompraId (la membresía comprada cubre la clase).
// Si la sesión está llena y tiene lista de espera, queda con estadoCupo = "espera".
// El precio lo calcula el servidor con la tarifa de la clase. Devuelve la reservación con su código.
router.post('/', asyncHandler(async (req, res) => {
    const reservacion = await crearReservacion(req.body, String(req.body?.idCliente ?? ''), req.body?.estatus);
    res.status(201).json(reservacion);
}));

// Edición de estado: solo pendiente <-> confirmada.
router.patch('/:id', asyncHandler(async (req, res) => {
    res.json(await cambiarEstatus(String(req.params.id), req.body?.estatus));
}));

// Baja: cancelación (no se borra el registro).
router.patch('/:id/cancelar', asyncHandler(async (req, res) => {
    res.json(await cancelarReservacion(String(req.params.id), { forzar: forzar(req.body) }));
}));

// Reagendar. Body: idHorario del nuevo horario (clase, hora y fecha salen de ahí).
router.patch('/:id/reagendar', asyncHandler(async (req, res) => {
    res.json(await reagendarReservacion(String(req.params.id), req.body, { forzar: forzar(req.body) }));
}));

// Confirma la asistencia: debe estar pagada o cubierta y ser el día de la sesión (salvo `forzar`).
router.patch('/:id/asistencia', asyncHandler(async (req, res) => {
    res.json(await marcarAsistencia(String(req.params.id), { forzar: forzar(req.body) }));
}));

// Marca la reservación como pagada. Body: metodoPago, folioPago (el pago en sí lo guarda el módulo de cobro).
router.patch('/:id/pago', asyncHandler(async (req, res) => {
    res.json(await registrarPago(String(req.params.id), req.body ?? {}));
}));

router.patch('/:id/inasistencia', asyncHandler(async (req, res) => {
    res.json(await marcarInasistencia(String(req.params.id)));
}));

// Las reservaciones no se eliminan.
router.delete('/:id', (_req, res) => {
    res.status(405).json({ error: 'Las reservaciones no se eliminan. Usa PATCH /:id/cancelar.' });
});

router.use(manejarReglas);
router.use(manejarErrores);

export default router;