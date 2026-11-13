import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { Cliente } from '../models/cliente';
import { Horario } from '../models/horario';
import { Clase } from '../models/clase';
import { Reservacion } from '../models/reservacion';
import { fechaLocal, instante, sumarDias } from '../lib/fecha';
import { campoDuplicado, codigoReservacion } from '../lib/codigo';
import {
    claseIniciada, estadoReserva, iniciales, paqueteCubre, precioClase, puedeCancelar, puedeReagendar,
    type MembresiaDoc,
} from '../lib/reglas';
import { itemReserva, precioPorDefecto } from '../lib/vista';

const router = Router();

const MAX_HISTORIAL = 100;

// Busca una reservación que pertenezca al cliente de la sesión
async function propia(req: { params: { id?: string } }, idCliente: string) {
    const id = req.params.id;
    if (!id || !isValidObjectId(id)) return null;
    return Reservacion.findOne({ _id: id, idCliente });
}

const horaClase = (h: { horaInicio: string; horaFin: string }) => `${h.horaInicio} - ${h.horaFin}`;

// GET /api/reservaciones?tipo=proximas|historial
// Pantalla "Mis reservas": devuelve las dos pestañas con sus contadores.
router.get('/', async (req, res) => {
    const idCliente = String(res.locals.cliente._id);
    const ahora = new Date();
    const todas = await Reservacion.find({ idCliente }).sort({ fechaClase: -1 });

    const items = todas.map((r) => itemReserva(r, ahora));
    const clave = (i: (typeof items)[number]) => instante(i.fechaClase, i.horaInicio).getTime();
    const proximas = items.filter((i) => i.estado === 'proxima').sort((a, b) => clave(a) - clave(b));
    const historial = items.filter((i) => i.estado !== 'proxima').sort((a, b) => clave(b) - clave(a)).slice(0, MAX_HISTORIAL);

    const tipo = req.query.tipo;
    res.json({
        conteo: { proximas: proximas.length, historial: historial.length },
        proximas: tipo === 'historial' ? [] : proximas,
        historial: tipo === 'proximas' ? [] : historial,
    });
});

// GET /api/reservaciones/:id — detalle para "Ver QR" (el QR contiene el campo codigo)
router.get('/:id', async (req, res) => {
    const r = await propia(req, String(res.locals.cliente._id));
    if (!r) return res.status(404).json({ error: 'Reservación no encontrada' });
    res.json(itemReserva(r, new Date()));
});

// POST /api/reservaciones  { idHorario }
// Reserva la clase: usa un acceso del paquete si lo cubre; si no, se paga en recepción.
router.post('/', async (req, res) => {
    const cliente = res.locals.cliente;
    const idCliente = String(cliente._id);
    const { idHorario } = req.body ?? {};
    if (!isValidObjectId(idHorario)) return res.status(400).json({ error: 'Elige una clase para reservar' });

    const horario = await Horario.findById(idHorario);
    if (!horario || horario.estatus !== 'activo') return res.status(404).json({ error: 'Clase no encontrada' });

    const ahora = new Date();
    const hoy = fechaLocal(ahora);
    if (claseIniciada(horario.fecha, horario.horaInicio, ahora)) {
        return res.status(409).json({ error: 'Esa clase ya comenzó o terminó' });
    }

    const duplicada = await Reservacion.findOne({ idCliente, idHorario: String(horario._id), estatus: { $ne: 'cancelada' } });
    if (duplicada) return res.status(409).json({ error: 'Ya tienes una reservación en esta clase' });

    const membresia = cliente.membresia as MembresiaDoc | null;
    const clase = await Clase.findById(horario.idClase);
    const monto = precioClase(clase?.precio, precioPorDefecto());

    // 1) Acceso del paquete (descuento atómico: nunca pasa del total aunque se reserve dos veces a la vez)
    let usoPaquete = false;
    let restantesDespues: number | null = null;
    if (paqueteCubre(membresia, horario.nombreClase, hoy)) {
        const act = await Cliente.findOneAndUpdate(
            {
                _id: cliente._id,
                'membresia.estatus': 'activo',
                'membresia.fechaFin': { $gte: hoy },
                $expr: { $lt: [{ $ifNull: ['$membresia.clasesUsadas', 0] }, '$membresia.clasesTotal'] },
            },
            { $inc: { 'membresia.clasesUsadas': 1 } },
            { new: true }
        );
        if (act?.membresia) {
            usoPaquete = true;
            restantesDespues = Number(act.membresia.clasesTotal ?? 0) - Number(act.membresia.clasesUsadas ?? 0);
        }
    }
    const devolverAcceso = () =>
        usoPaquete ? Cliente.updateOne({ _id: cliente._id }, { $inc: { 'membresia.clasesUsadas': -1 } }) : Promise.resolve();

    // 2) Lugar en la clase (descuento atómico)
    const lugar = await Horario.findOneAndUpdate(
        { _id: horario._id, estatus: 'activo', capacidadDisponible: { $gt: 0 } },
        { $inc: { capacidadDisponible: -1 } },
        { new: true }
    );
    if (!lugar) {
        await devolverAcceso();
        return res.status(409).json({ error: 'La clase se llenó. Elige otro horario' });
    }

    // 3) Reservación con su código para el QR
    try {
        for (let intento = 0; intento < 5; intento++) {
            try {
                const nueva = await Reservacion.create({
                    idCliente,
                    nombreCliente: `${cliente.nombre} ${cliente.apellidos}`,
                    idHorario: String(horario._id),
                    clase: horario.nombreClase,
                    entrenador: horario.nombreEntrenador,
                    horaClase: horaClase(horario),
                    fechaClase: horario.fecha,
                    fechaReservacion: hoy,
                    estatus: 'confirmada',
                    asistenciaConfirmada: false,
                    codigo: codigoReservacion(),
                    pagoTipo: usoPaquete ? 'paquete' : 'recepcion',
                    monto: usoPaquete ? 0 : monto,
                    reagendada: false,
                });
                return res.status(201).json({ ...itemReserva(nueva, ahora), accesosRestantes: restantesDespues });
            } catch (err) {
                if (campoDuplicado(err) !== 'codigo') throw err; // solo se reintenta si chocó el código
            }
        }
        throw new Error('No se pudo generar un código de reservación único');
    } catch (err) {
        // Si algo falla, se devuelven el lugar y el acceso
        await Horario.updateOne({ _id: horario._id }, { $inc: { capacidadDisponible: 1 } });
        await devolverAcceso();
        throw err;
    }
});

// POST /api/reservaciones/:id/cancelar
// Solo con 24 h o más de anticipación. Se libera el lugar; no hay reembolso del acceso ni del pago.
router.post('/:id/cancelar', async (req, res) => {
    const r = await propia(req, String(res.locals.cliente._id));
    if (!r) return res.status(404).json({ error: 'Reservación no encontrada' });

    const ahora = new Date();
    if (estadoReserva(r, ahora) !== 'proxima') return res.status(409).json({ error: 'Esa reservación ya no se puede cancelar' });
    if (!puedeCancelar(r, ahora)) {
        return res.status(409).json({ error: 'Ya no se puede cancelar: faltan menos de 24 horas para la clase' });
    }

    const cancelada = await Reservacion.findOneAndUpdate(
        { _id: r._id, estatus: { $ne: 'cancelada' } },
        { estatus: 'cancelada', fechaCancelacion: fechaLocal(ahora) },
        { new: true }
    );
    if (!cancelada) return res.status(409).json({ error: 'Esa reservación ya estaba cancelada' });

    await Horario.updateOne({ _id: r.idHorario }, { $inc: { capacidadDisponible: 1 } });
    res.json(itemReserva(cancelada, ahora));
});

// GET /api/reservaciones/:id/opciones-reagendar
// Hasta 6 horarios próximos de la misma clase con lugar disponible.
router.get('/:id/opciones-reagendar', async (req, res) => {
    const idCliente = String(res.locals.cliente._id);
    const r = await propia(req, idCliente);
    if (!r) return res.status(404).json({ error: 'Reservación no encontrada' });

    const ahora = new Date();
    if (r.reagendada) return res.status(409).json({ error: 'Esta clase ya se reagendó una vez; no puede volver a cambiarse' });
    if (!puedeReagendar(r, ahora)) return res.status(409).json({ error: 'Esa reservación ya no se puede reagendar' });

    const hoy = fechaLocal(ahora);
    const candidatos = await Horario.find({
        nombreClase: r.clase,
        estatus: 'activo',
        capacidadDisponible: { $gt: 0 },
        fecha: { $gte: hoy, $lte: sumarDias(hoy, 30) },
        _id: { $ne: r.idHorario },
    }).sort({ fecha: 1, horaInicio: 1 });

    const ocupadas = new Set(
        (await Reservacion.find({ idCliente, estatus: { $ne: 'cancelada' }, idHorario: { $in: candidatos.map((h) => String(h._id)) } })).map((x) => x.idHorario)
    );

    const opciones = candidatos
        .filter((h) => !claseIniciada(h.fecha, h.horaInicio, ahora) && !ocupadas.has(String(h._id)))
        .slice(0, 6)
        .map((h) => ({
            idHorario: String(h._id),
            clase: h.nombreClase,
            fecha: h.fecha,
            horaInicio: h.horaInicio,
            horaFin: h.horaFin,
            entrenador: h.nombreEntrenador,
            entrenadorIniciales: iniciales(h.nombreEntrenador),
            disponibles: h.capacidadDisponible,
        }));

    res.json({ reservacion: itemReserva(r, ahora), opciones });
});

// POST /api/reservaciones/:id/reagendar  { idHorario }
// Una sola vez y sin costo: mismo tipo de clase, conserva el código y no consume otro acceso.
router.post('/:id/reagendar', async (req, res) => {
    const idCliente = String(res.locals.cliente._id);
    const r = await propia(req, idCliente);
    if (!r) return res.status(404).json({ error: 'Reservación no encontrada' });

    const ahora = new Date();
    if (r.reagendada) return res.status(409).json({ error: 'Esta clase ya se reagendó una vez; no puede volver a cambiarse' });
    if (!puedeReagendar(r, ahora)) return res.status(409).json({ error: 'Esa reservación ya no se puede reagendar' });

    const { idHorario } = req.body ?? {};
    if (!isValidObjectId(idHorario)) return res.status(400).json({ error: 'Elige el nuevo horario' });
    if (idHorario === r.idHorario) return res.status(400).json({ error: 'Elige un horario distinto al actual' });

    const nuevo = await Horario.findById(idHorario);
    if (!nuevo || nuevo.estatus !== 'activo') return res.status(404).json({ error: 'Clase no encontrada' });
    if (nuevo.nombreClase !== r.clase) return res.status(409).json({ error: 'Solo puedes reagendar a otro horario de la misma clase' });
    if (claseIniciada(nuevo.fecha, nuevo.horaInicio, ahora)) return res.status(409).json({ error: 'Esa clase ya comenzó o terminó' });

    const yaTiene = await Reservacion.findOne({ idCliente, idHorario: String(nuevo._id), estatus: { $ne: 'cancelada' } });
    if (yaTiene) return res.status(409).json({ error: 'Ya tienes una reservación en ese horario' });

    // 1) apartar lugar en el nuevo horario
    const lugar = await Horario.findOneAndUpdate(
        { _id: nuevo._id, estatus: 'activo', capacidadDisponible: { $gt: 0 } },
        { $inc: { capacidadDisponible: -1 } },
        { new: true }
    );
    if (!lugar) return res.status(409).json({ error: 'Ese horario se llenó. Elige otro' });

    // 2) mover la reservación (solo si sigue vigente y sin reagendar)
    const antes = { idHorario: r.idHorario };
    const movida = await Reservacion.findOneAndUpdate(
        { _id: r._id, idCliente, estatus: { $ne: 'cancelada' }, reagendada: { $ne: true }, idHorario: antes.idHorario },
        {
            idHorario: String(nuevo._id),
            entrenador: nuevo.nombreEntrenador,
            horaClase: horaClase(nuevo),
            fechaClase: nuevo.fecha,
            reagendada: true,
        },
        { new: true }
    );
    if (!movida) {
        await Horario.updateOne({ _id: nuevo._id }, { $inc: { capacidadDisponible: 1 } });
        return res.status(409).json({ error: 'No se pudo reagendar: la reservación cambió. Revisa tus reservas' });
    }

    // 3) liberar el lugar del horario anterior
    await Horario.updateOne({ _id: antes.idHorario }, { $inc: { capacidadDisponible: 1 } });
    res.json(itemReserva(movida, ahora));
});

export default router;
