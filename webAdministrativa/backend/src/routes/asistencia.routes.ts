import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { RegistroAsistencia } from '../models/Asistencia/asistencia';
import { Cliente } from '../models/Clientes/cliente';
import { pool } from '../lib/post';
import { requireRole } from '../middleware/auth';
import { fechaLocal, horaLocal, minutosEntre } from '../lib/fecha';
import { rolApiADb, rolDbAApi, type UsuarioRow } from '../lib/usuarios';

const router = Router();
const staff = requireRole('administrador', 'recepcion');

// Minutos de tolerancia antes de contar un retardo
const TOLERANCIA_MIN = 10;

// GET /api/asistencia?tipoPersona=cliente|personal&desde=&hasta=
router.get('/', staff, async (req, res) => {
    const { tipoPersona, desde, hasta } = req.query;
    const filtro: Record<string, unknown> = {};
    if (tipoPersona === 'cliente' || tipoPersona === 'personal') filtro.tipoPersona = tipoPersona;
    if (desde || hasta) {
        filtro.fecha = {
            ...(typeof desde === 'string' && desde ? { $gte: desde } : {}),
            ...(typeof hasta === 'string' && hasta ? { $lte: hasta } : {}),
        };
    }
    const registros = await RegistroAsistencia.find(filtro).sort({ fecha: -1, horaEntrada: -1 }).limit(500);
    res.json(registros);
});

// POST /api/asistencia
//  - { tipoPersona: 'cliente',  idPersona }                          → registra una visita (entrada)
//  - { tipoPersona: 'personal', idPersona }                          → registra entrada; marca retardo según su turno
//  - { tipoPersona: 'personal', idPersona, tipoRegistro: 'falta' }   → registra una falta
// La fecha y hora son las del servidor en la zona del negocio, a menos que se manden.
router.post('/', staff, async (req, res) => {
    const { tipoPersona, idPersona, tipoRegistro } = req.body ?? {};
    const fecha: string = req.body?.fecha || fechaLocal();

    if ((tipoPersona !== 'cliente' && tipoPersona !== 'personal') || !idPersona) {
        return res.status(400).json({ error: 'tipoPersona (cliente|personal) e idPersona son obligatorios' });
    }

    if (tipoPersona === 'cliente') {
        if (!isValidObjectId(idPersona)) return res.status(400).json({ error: 'idPersona inválido' });
        const cliente = await Cliente.findById(idPersona);
        if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
        if (String(cliente.estatus) !== 'activo') return res.status(409).json({ error: 'El cliente está inactivo' });

        const visita = await RegistroAsistencia.create({
            tipoPersona,
            idPersona: String(cliente._id),
            nombrePersona: `${cliente.nombre} ${cliente.apellidos}`,
            fecha,
            horaEntrada: req.body?.horaEntrada || horaLocal(),
            tipoRegistro: 'asistencia',
        });
        return res.status(201).json(visita);
    }

    // Personal
    const id = Number(idPersona);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'idPersona inválido' });

    const { rows } = await pool.query<UsuarioRow>(
        'SELECT id_usuario, nombre, apellidos, rol, estatus, turno_entrada FROM webadministrativa.usuarios WHERE id_usuario = $1',
        [id]
    );
    const empleado = rows[0];
    if (!empleado) return res.status(404).json({ error: 'Empleado no encontrado' });
    if (!empleado.estatus) return res.status(409).json({ error: 'El empleado está inactivo' });

    const yaRegistrado = await RegistroAsistencia.findOne({ tipoPersona: 'personal', idPersona: String(id), fecha });
    if (yaRegistrado) return res.status(409).json({ error: 'Ese empleado ya tiene un registro en esa fecha' });

    const base = {
        tipoPersona,
        idPersona: String(id),
        nombrePersona: `${empleado.nombre} ${empleado.apellidos}`,
        rol: rolDbAApi(empleado.rol),
        fecha,
    };

    if (tipoRegistro === 'falta') {
        const falta = await RegistroAsistencia.create({ ...base, tipoRegistro: 'falta' });
        return res.status(201).json(falta);
    }

    const horaEntrada: string = req.body?.horaEntrada || horaLocal();
    const llegoTarde =
        !!empleado.turno_entrada && minutosEntre(empleado.turno_entrada, horaEntrada) > TOLERANCIA_MIN;

    const registro = await RegistroAsistencia.create({
        ...base,
        horaEntrada,
        tipoRegistro: llegoTarde ? 'retardo' : 'asistencia',
    });
    res.status(201).json(registro);
});

// PATCH /api/asistencia/:id/salida  → registra la hora de salida
router.patch('/:id/salida', staff, async (req, res) => {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Id de registro inválido' });
    const registro = await RegistroAsistencia.findByIdAndUpdate(
        req.params.id,
        { horaSalida: req.body?.horaSalida || horaLocal() },
        { new: true }
    );
    if (!registro) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(registro);
});

export default router;
