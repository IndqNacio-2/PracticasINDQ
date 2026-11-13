import { Router } from 'express';
import { Reservacion } from '../models/Reservaciones/reservacion';
import { Horario } from '../models/Horarios/horarios';
import { esObjectId, esFechaISO } from '../lib/validacion';

const router = Router();
const COBRO_API = process.env.COBRO_API_URL ?? 'http://localhost:3000/cobro/api';

// Todas las escrituras pasan por las transacciones y reglas de Recepción.
async function enviarCobro(res: any, ruta: string, metodo: string, datos: unknown) {
    try {
        const respuesta = await fetch(`${COBRO_API}${ruta}`, {
            method: metodo, headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos), signal: AbortSignal.timeout(15000),
        });
        const cuerpo = await respuesta.json();
        return res.status(respuesta.status).json(cuerpo);
    } catch {
        return res.status(503).json({ error: 'No se pudo contactar con Recepción. No se confirmó ningún cambio; consulta la reservación antes de reintentar.' });
    }
}

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
// Adaptador del contrato administrativo al registro único de Recepción.
router.post('/', async (req, res) => {
    const { idCliente, idHorario, fechaReservacion, horaClase } = req.body ?? {};
    const clienteId = Number(idCliente);
    if (!Number.isSafeInteger(clienteId) || clienteId <= 0) return res.status(400).json({ error: 'Selecciona un cliente registrado en Recepción por su ID numérico.' });
    if (!esObjectId(idHorario) || !esFechaISO(fechaReservacion)) return res.status(400).json({ error: 'Selecciona un horario y una fecha válidos.' });
    const horario: any = await Horario.findById(idHorario);
    if (!horario) return res.status(404).json({ error: 'El horario seleccionado no existe.' });
    if (horario.fecha !== fechaReservacion || (horaClase !== undefined && horaClase !== horario.horaInicio)) {
        return res.status(409).json({ error: 'La fecha y hora no coinciden con la sesión seleccionada.' });
    }
    return enviarCobro(res, '/reservas', 'POST', {
        clienteId, client: 'Cliente registrado', type: 'cliente', horarioId: idHorario,
        class: horario.nombreClase, time: horario.horaInicio, fecha: fechaReservacion, origen: 'recepcion',
    });
});

router.post('/:id/reagendar', async (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(409).json({ error: 'Esta reservación histórica no tiene un ID de Recepción. Su historial se conserva; requiere conciliación antes de reagendar.' });
    return enviarCobro(res, `/reservas/${req.params.id}/reagendar`, 'POST', {
        horarioId: req.body?.horarioId ?? req.body?.idHorario,
        fecha: req.body?.fecha ?? req.body?.fechaReservacion,
    });
});

// PATCH /api/reservaciones/:id
// Usado para cambiar estatus (confirmar/cancelar) y/o confirmar asistencia.
router.patch('/:id', async (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(409).json({ error: 'Esta reservación histórica no tiene un ID de Recepción. Su historial se conserva; requiere conciliación antes de modificarla.' });
    const datos = req.body ?? {};
    const esCambioHorario = datos.idHorario !== undefined || datos.horarioId !== undefined;
    if (esCambioHorario) {
        const campos = ['idHorario', 'horarioId', 'fecha', 'fechaReservacion'];
        if (Object.keys(datos).some(campo => !campos.includes(campo))) return res.status(400).json({ error: 'Envía únicamente el nuevo horario y fecha para reagendar.' });
        return enviarCobro(res, `/reservas/${req.params.id}/reagendar`, 'POST', {
            horarioId: datos.idHorario ?? datos.horarioId, fecha: datos.fechaReservacion ?? datos.fecha,
        });
    }
    if (Object.keys(datos).some(campo => !['status', 'estatus', 'asistenciaConfirmada'].includes(campo))) return res.status(400).json({ error: 'No se permite modificar directamente los datos de la reservación.' });
    const status = datos.status ?? (datos.estatus === 'cancelada' ? 'cancelado' : datos.asistenciaConfirmada === true ? 'asistido' : undefined);
    return enviarCobro(res, `/reservas/${req.params.id}`, 'PATCH', { status });
});

export default router;