import { Router } from 'express';
import { ADMIN_API_URL } from '../middleware/personal';

// Confirmación de asistencia (solo personal: administrador o recepción).
// Las reglas viven en la web administrativa (una sola implementación para cobro, administrativa y la app):
//   - la reservación debe estar pagada o cubierta por una membresía,
//   - solo se confirma el día de la clase y con lugar confirmado (no en lista de espera),
//   - al confirmar, la reservación pasa de "pendiente" a "confirmada".
const router = Router();

const CODIGO = /^NU-\d{5}$/i;

async function administrativa(req: { headers: { authorization?: string } }, ruta: string, metodo = 'GET') {
    const r = await fetch(`${ADMIN_API_URL}${ruta}`, {
        method: metodo,
        headers: { Authorization: req.headers.authorization ?? '', ...(metodo !== 'GET' ? { 'Content-Type': 'application/json' } : {}) },
        body: metodo !== 'GET' ? '{}' : undefined,
        signal: AbortSignal.timeout(10000),
    });
    const datos: any = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, datos };
}

const vista = (r: any) => ({
    idReservacion: r.idReservacion,
    codigo: r.codigo,
    cliente: r.nombreCliente,
    clase: r.clase,
    fechaClase: r.fechaClase,
    horaClase: r.horaClase,
    pagada: r.estadoPago === 'pagado',
    enListaDeEspera: r.estadoCupo === 'espera',
    confirmacion: r.asistenciaConfirmada ? 'confirmada' : r.estatus === 'cancelada' ? 'cancelada' : 'pendiente',
    estatus: r.estatus,
    asistenciaConfirmada: Boolean(r.asistenciaConfirmada),
});

// GET /api/asistencia/:codigo — datos de la reservación antes de confirmar (por ejemplo al escanear el QR)
router.get('/:codigo', async (req, res) => {
    if (!CODIGO.test(req.params.codigo)) return res.status(400).json({ error: 'El código debe tener el formato NU-12345' });
    const r = await administrativa(req, `/reservaciones/codigo/${encodeURIComponent(req.params.codigo.toUpperCase())}`);
    if (!r.ok) return res.status(r.status).json({ error: r.datos.error ?? 'Reservación no encontrada' });
    res.json(vista(r.datos));
});

// POST /api/asistencia/confirmar  { codigo }
// El personal confirma que el cliente llegó a su clase. La reservación queda "confirmada" y con asistencia.
router.post('/confirmar', async (req, res) => {
    const codigo = String(req.body?.codigo ?? '').trim().toUpperCase();
    if (!CODIGO.test(codigo)) return res.status(400).json({ error: 'El código debe tener el formato NU-12345' });

    const buscada = await administrativa(req, `/reservaciones/codigo/${encodeURIComponent(codigo)}`);
    if (!buscada.ok) return res.status(buscada.status).json({ error: buscada.datos.error ?? 'Reservación no encontrada' });

    const confirmada = await administrativa(req, `/reservaciones/${buscada.datos.idReservacion}/asistencia`, 'PATCH');
    if (!confirmada.ok) return res.status(confirmada.status).json({ error: confirmada.datos.error ?? 'No se pudo confirmar la asistencia' });
    res.json({ mensaje: 'Asistencia confirmada', reservacion: vista(confirmada.datos) });
});

export default router;
