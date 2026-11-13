import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { Horario } from '../models/horario';
import { Clase } from '../models/clase';
import { Reservacion } from '../models/reservacion';
import { diaSemana, fechaLocal, sumarDias } from '../lib/fecha';
import { POLITICAS, type MembresiaDoc } from '../lib/reglas';
import { detallePago, itemHorario, type ContextoHorarios } from '../lib/vista';

const router = Router();

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const DIAS_MAXIMOS = 60;

// Arma el contexto del cliente: sus reservaciones vigentes y los precios de las clases involucradas
async function contexto(idCliente: string, membresia: MembresiaDoc | null, horarios: { _id: unknown; idClase: string }[]): Promise<ContextoHorarios> {
    const ids = horarios.map((h) => String(h._id));
    const idsClase = [...new Set(horarios.map((h) => h.idClase))].filter((i) => isValidObjectId(i));

    const [reservaciones, clases] = await Promise.all([
        Reservacion.find({ idCliente, idHorario: { $in: ids }, estatus: { $ne: 'cancelada' } }),
        Clase.find({ _id: { $in: idsClase } }),
    ]);

    return {
        ahora: new Date(),
        hoy: fechaLocal(),
        membresia,
        precios: new Map(clases.filter((c) => typeof c.precio === 'number').map((c) => [String(c._id), c.precio as number])),
        reservadas: new Map(reservaciones.map((r) => [r.idHorario, String(r._id)])),
    };
}

// GET /api/horarios/dias?cantidad=14
// Los días para la tira de fechas (hoy incluido) y cuántas clases hay en cada uno.
router.get('/dias', async (req, res) => {
    const cantidad = Math.min(DIAS_MAXIMOS, Math.max(1, Number(req.query.cantidad) || 14));
    const hoy = fechaLocal();
    const ultimo = sumarDias(hoy, cantidad - 1);

    const conteos: { _id: string; n: number }[] = await Horario.aggregate([
        { $match: { estatus: 'activo', fecha: { $gte: hoy, $lte: ultimo } } },
        { $group: { _id: '$fecha', n: { $sum: 1 } } },
    ]);
    const porFecha = new Map(conteos.map((c) => [c._id, c.n]));

    res.json({
        hoy,
        dias: Array.from({ length: cantidad }, (_, i) => {
            const fecha = sumarDias(hoy, i);
            return { fecha, diaSemana: diaSemana(fecha), esHoy: i === 0, clases: porFecha.get(fecha) ?? 0 };
        }),
    });
});

// GET /api/horarios?fecha=YYYY-MM-DD&clase=Pilates
// Clases de un día con cupo, entrenador y si están incluidas en el paquete del cliente.
router.get('/', async (req, res) => {
    const hoy = fechaLocal();
    const fecha = typeof req.query.fecha === 'string' ? req.query.fecha : hoy;
    if (!FECHA.test(fecha)) return res.status(400).json({ error: 'La fecha debe tener formato AAAA-MM-DD' });
    if (fecha < hoy) return res.status(400).json({ error: 'Solo se pueden consultar clases de hoy en adelante' });
    if (fecha > sumarDias(hoy, DIAS_MAXIMOS)) return res.status(400).json({ error: `Solo se pueden consultar los próximos ${DIAS_MAXIMOS} días` });

    const filtroClase = typeof req.query.clase === 'string' && req.query.clase.trim() ? req.query.clase.trim() : null;

    // El horario de atención se calcula con todas las clases del día, aunque se filtre por tipo
    const delDia = await Horario.find({ fecha, estatus: 'activo' }).sort({ horaInicio: 1 });
    const horarioAtencion = delDia.length
        ? { inicio: delDia[0].horaInicio, fin: delDia.reduce((max, h) => (h.horaFin > max ? h.horaFin : max), delDia[0].horaFin) }
        : null;

    const lista = filtroClase ? delDia.filter((h) => h.nombreClase.toLowerCase() === filtroClase.toLowerCase()) : delDia;
    const ctx = await contexto(String(res.locals.cliente._id), res.locals.cliente.membresia as MembresiaDoc | null, lista);

    res.json({ fecha, diaSemana: diaSemana(fecha), horarioAtencion, horarios: lista.map((h) => itemHorario(h, ctx)) });
});

// GET /api/horarios/:id — hoja de confirmación: detalle, cómo se pagaría y políticas
router.get('/:id', async (req, res) => {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Id de horario inválido' });
    const horario = await Horario.findById(req.params.id);
    if (!horario || horario.estatus !== 'activo') return res.status(404).json({ error: 'Clase no encontrada' });

    const membresia = res.locals.cliente.membresia as MembresiaDoc | null;
    const ctx = await contexto(String(res.locals.cliente._id), membresia, [horario]);
    const item = itemHorario(horario, ctx);

    res.json({ ...item, pago: detallePago(item, membresia, ctx.hoy), politicas: POLITICAS });
});

export default router;
