import { Router } from 'express';
import { asyncHandler, manejarErrores } from '../lib/asynchandler';
import { manejarReglas } from '../services/reservaciones.service';
import {
    activarCompra,
    buscarPorCodigo,
    buscarPorId,
    cancelarCompra,
    comprasDeCliente,
    cotizarCompra,
    crearCompra,
    listarCompras,
    resumenPorCliente,
} from '../services/compras-membresia.service';

// Compras de membresía (staff). Los permisos por rol están en middleware/permisos.ts.
// La app móvil usa las mismas reglas a través de movilClientes/backendMovil (membresias-core compartido).
const router = Router();

// Consulta: ?idCliente= & ?estado=apartada|activa|cancelada & ?codigo=PQ-XXXXX & ?solicitudId=
router.get('/', asyncHandler(async (req, res) => {
    res.json(await listarCompras(req.query as Record<string, unknown>));
}));

// { <idCliente>: { tieneCompras, membresiasCompradas } }: lo que muestra la lista de clientes de cobro.
router.get('/resumen', asyncHandler(async (_req, res) => {
    res.json(await resumenPorCliente());
}));

// Compras de un cliente con su saldo de entradas (consumidas, apartadas y disponibles).
router.get('/cliente/:idCliente', asyncHandler(async (req, res) => {
    res.json(await comprasDeCliente(String(req.params.idCliente)));
}));

// Precio y vigencia de una compra antes de cobrarla. Body: idCliente, idMembresia, idOpcion, fechaInicio.
router.post('/cotizar', asyncHandler(async (req, res) => {
    res.json(await cotizarCompra(req.body ?? {}));
}));

router.get('/codigo/:codigo', asyncHandler(async (req, res) => {
    res.json(await buscarPorCodigo(String(req.params.codigo)));
}));

router.get('/:id', asyncHandler(async (req, res) => {
    res.json(await buscarPorId(String(req.params.id)));
}));

// Alta. Body: idCliente, idMembresia, idOpcion, estado ('apartada' | 'activa'), origen, solicitudId,
//   y si ya se pagó: fechaInicio, metodoPago, folioPago. Devuelve la compra con su código PQ-XXXXX.
router.post('/', asyncHandler(async (req, res) => {
    const { compra, repetida } = await crearCompra(req.body ?? {});
    res.status(repetida ? 200 : 201).json({ ...compra, repetida });
}));

// Cobra una membresía apartada. Body: metodoPago, folioPago, fechaInicio (opcional, por defecto hoy).
router.patch('/:id/activar', asyncHandler(async (req, res) => {
    res.json(await activarCompra(String(req.params.id), req.body ?? {}));
}));

// Cancela una membresía apartada que no se pagó.
router.patch('/:id/cancelar', asyncHandler(async (req, res) => {
    res.json(await cancelarCompra(String(req.params.id)));
}));

router.use(manejarReglas);
router.use(manejarErrores);

export default router;
