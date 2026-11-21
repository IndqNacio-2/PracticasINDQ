// Backend de la aplicación web de cobro (front desk).
//
// Antes guardaba todo en arreglos en memoria; ahora usa el PostgreSQL
// compartido de la carpeta de punto de venta, dentro del esquema webcobro.
// Los campos de las respuestas se mantienen igual que antes (client, class,
// time, status, price) para que las pantallas sigan funcionando sin cambios.
require('dotenv/config');

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { imprimirTicket } = require('./ticketService');
const membresiasService = require('./membresiasService');
const { requerirRol } = require('./autorizacion');
const { accesoClientes } = require('./permisosPersonal');
const { crearClientesAdmin } = require('./clientesAdmin');
const { crearReservasAdmin } = require('./reservasAdmin');

const app = express();

app.use(cors()); //permite que react hable con este backend
app.use(express.json());
app.use('/api/clientes', accesoClientes);

// El panel administrativo se sirve por este mismo gateway (monto /admin/api) en
// el mismo puerto 3000 que este backend de cobro, por lo que la llamada es
// interna y no atraviesa el navegador. Cada POST /api/reservas consulta estos
// horarios para garantizar que la clase + hora elegida existe de verdad.
const ADMIN_API = process.env.ADMIN_API_URL ?? 'http://localhost:3000/admin/api';

// Permisos por rol (administrador, recepcion = cobro, vendedor = punto de venta).
// La sesión se valida contra la API administrativa: ver autorizacion.js.
const adminORecepcion = requerirRol(ADMIN_API, 'administrador', 'recepcion');
const soloRecepcion = requerirRol(ADMIN_API, 'recepcion');
const soloAdministrador = requerirRol(ADMIN_API, 'administrador');
const todoElPersonal = requerirRol(ADMIN_API, 'administrador', 'recepcion', 'vendedor');
// Los clientes viven en MongoDB (administrativa): cobro los consulta por su API.
const clientesAdmin = crearClientesAdmin(ADMIN_API);
// Las reservaciones también: cobro las lee y escribe por la API de administrativa (MongoDB).
const reservasAdmin = crearReservasAdmin(ADMIN_API);

// Conexion con PostgreSQL /////////////////////////////////////
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

// Si una conexion inactiva del pool falla, se avisa en consola.
pool.on('error', (error) => {
  console.error('Error inesperado en el pool de PostgreSQL:', error.message);
});

membresiasService.registrarRutas(app, pool, ADMIN_API);

// Bitacora de consultas: imprime cada SQL con la hora que llega a PostgreSQL,
// para que la terminal del backend muestre los SELECT, INSERT, UPDATE y
// DELETE que se ejecutan al usar la aplicacion.
const consultaOriginal = pool.query.bind(pool);
pool.query = (texto, parametros) => {
  if (typeof texto === 'string') {
    const sql = texto.replace(/\s+/g, ' ').trim();
    const hora = new Date().toLocaleTimeString('es-MX');
    const datos = parametros && parametros.length && !/webcobro\.clientes/i.test(texto)
      ? ` -- datos: ${JSON.stringify(parametros)}`
      : '';
    console.log(`[SQL ${hora}] ${sql}${datos}`);
  }
  return consultaOriginal(texto, parametros);
};

// ===================================================================
// Reglas de reservaciones (Release 1.2.0)
// ===================================================================

// Estados que ya no apartan lugar ni cuentan como reservación activa.
const ESTADOS_INACTIVOS = ['cancelado', 'no_asistio'];

const dosDigitos = (n) => String(n).padStart(2, '0');

// 'YYYY-MM-DD HH:MM' en hora local, comparable como texto con fecha || ' ' || hora.
const marcaLocal = (d) =>
  `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())} ${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;

// Fecha/hora de inicio de la clase (hora local) o null si la reserva no tiene fecha.
const inicioDeClase = (fecha, hora) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '') || !/^\d{2}:\d{2}$/.test(hora || '')) return null;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const [h, m] = hora.split(':').map(Number);
  const inicio = new Date(anio, mes - 1, dia, h, m);
  return inicio.getFullYear() === anio && inicio.getMonth() === mes - 1 && inicio.getDate() === dia
    && h <= 23 && m <= 59 ? inicio : null;
};

const MOTIVO_POR_ESTADO = {
  asistido: 'El cliente ya asistió a esta clase.',
  no_asistio: 'El cliente no asistió a su clase: no tiene reembolso y no se puede reagendar.',
  cancelado: 'La reservación ya está cancelada.',
};

/*
 * Decide si una reservación (con los nombres que devuelve reservasAdmin.js) se puede
 * cancelar o reagendar en este momento. Devuelve el motivo cuando no se puede,
 * o null cuando sí. Es la misma regla para recepción y para la app móvil.
 */
const reglasDeReserva = (r, ahora = new Date()) => {
  const inicio = inicioDeClase(r.fecha, r.time);
  const yaInicio = inicio ? inicio.getTime() <= ahora.getTime() : false;
  const motivoEstado = MOTIVO_POR_ESTADO[r.status] ?? null;

  // Recepción puede cancelar hasta que empiece la clase (el plazo de 24 horas de antelación es para el
  // cliente en la app móvil; administrativa lo aplica ahí y recepción lo salta con `forzar`).
  let motivoNoCancelar = motivoEstado;
  if (!motivoNoCancelar && yaInicio) {
    motivoNoCancelar = 'La clase ya comenzó, ya no se puede cancelar.';
  }

  let motivoNoReagendar = motivoEstado;
  if (!motivoNoReagendar && r.reagendada) {
    motivoNoReagendar = 'Esta reservación ya se reagendó una vez; solo se permite reagendar una vez.';
  }
  if (!motivoNoReagendar && yaInicio) {
    motivoNoReagendar = 'La clase ya comenzó, ya no se puede reagendar.';
  }

  return { motivoNoCancelar, motivoNoReagendar, cancelableHasta: null };
};

// Agrega a la reservación las banderas que usan recepción y la app móvil.
const decorarReserva = (r) => {
  if (!r) return r;
  const reglas = reglasDeReserva(r);
  return {
    ...r,
    puedeCancelar: !reglas.motivoNoCancelar,
    puedeReagendar: !reglas.motivoNoReagendar,
    motivoNoCancelar: reglas.motivoNoCancelar,
    motivoNoReagendar: reglas.motivoNoReagendar,
    cancelableHasta: reglas.cancelableHasta,
  };
};

/*
 * Inasistencia: toda reservación confirmada que sigue 'pendiente' cuando ya
 * pasó el inicio de su clase (más la tolerancia) se marca 'no_asistio'. El
 * cliente nunca llegó a recepción, así que no hay reembolso ni reagenda.
 * Las reservas pagadas no se tocan: pagar en recepción implica que llegó.
 */
// Ahora las marca administrativa (cada minuto y al consultar reservaciones): aquí ya no hay nada que hacer.
const marcarInasistencias = async () => 0;

// El código de reserva (NU-XXXXX) lo genera administrativa al crear la reservación.
// Acepta 'nu-48213', 'NU-48213' o 'PQ-07391'. Las reservas anteriores al cambio conservan su
// código 'RSV-XXXXXX', que se sigue reconociendo para poder consultarlas.
const normalizarCodigoReserva = (valor) => {
  const limpio = String(valor ?? '').trim().toUpperCase();
  if (/^(NU|PQ)-\d{5}$/.test(limpio)) return limpio;
  if (/^RSV-[A-Z0-9]{6}$/.test(limpio)) return limpio;
  return null;
};

/*
 * Busca en administrativa el horario activo de una fecha (por id o por
 * clase + hora) y la clase a la que pertenece (precio y capacidad).
 */
const buscarHorarioActivo = async (fecha, { horarioId, clase, time }, autorizacion) => {
  // Se reenvía la sesión de quien hace la petición: horarios y clases ya exigen token.
  const cabeceras = autorizacion ? { Authorization: autorizacion } : {};
  const [resHorarios, resClases] = await Promise.all([
    fetch(`${ADMIN_API}/horarios?fecha=${encodeURIComponent(fecha)}&estatus=activo`, { headers: cabeceras }),
    fetch(`${ADMIN_API}/clases`, { headers: cabeceras }),
  ]);
  if (!resHorarios.ok) throw new Error(`horarios HTTP ${resHorarios.status}`);
  if (!resClases.ok) throw new Error(`clases HTTP ${resClases.status}`);

  const horarios = await resHorarios.json();
  const clases = await resClases.json();

  const horario = Array.isArray(horarios)
    ? horarios.find((h) =>
      typeof horarioId === 'string' && horarioId
        ? h.idHorario === horarioId
        : h.nombreClase === clase && h.horaInicio === time
    ) ?? null
    : null;
  const claseReal = horario && Array.isArray(clases)
    ? clases.find((c) => c.idClase === horario.idClase) ?? null
    : null;
  if (!horario || !claseReal || claseReal.estatus !== 'activo'
    || horario.estatus !== 'activo' || horario.visibleReservas === false || horario.fecha !== fecha
    || !Number.isInteger(horario.capacidadTotal) || horario.capacidadTotal <= 0
    || !inicioDeClase(fecha, horario.horaInicio) || !inicioDeClase(fecha, horario.horaFin)
    || horario.horaFin <= horario.horaInicio) return { horario: null, clase: null };
  // Consulta directa, sin autenticar como usuario ni exponer el listado de empleados.
  const referencia = await fetch(`${ADMIN_API}/horarios/${encodeURIComponent(horario.idHorario)}/validacion`, { signal: AbortSignal.timeout(10000) });
  if (referencia.status === 404 || referencia.status === 409 || referencia.status === 400) return { horario: null, clase: null };
  if (!referencia.ok) throw new Error('No se pudo validar el entrenador de la sesión.');
  return { horario, clase: claseReal };
};

//Modulo para recepcion y cobro
// Las reservaciones viven en MongoDB (administrativa): aquí solo se traducen a la forma que usan las
// pantallas de cobro y se resuelve el pago, que sí se guarda en Postgres.

const ID_RESERVA = /^[a-f\d]{24}$/i;
const hoyLocal = () => marcaLocal(new Date()).slice(0, 10);

// Responde con el error de administrativa (reglas de negocio) o un mensaje genérico si algo se rompió.
const responderError = (res, error, mensajeGenerico) => {
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error(mensajeGenerico, error);
  return res.status(500).json({ error: mensajeGenerico });
};

//GET para las reservas
app.get('/api/reservas', adminORecepcion, async (req, res) => {
  try {
    const lista = await reservasAdmin.listar(req.headers.authorization);
    // Más antiguas primero, como las devolvía el historial anterior.
    lista.sort((a, b) => String(a.creadoEn).localeCompare(String(b.creadoEn)));
    res.json(lista.map(decorarReserva));
  } catch (error) {
    responderError(res, error, 'No se pudieron consultar las reservaciones.');
  }
});

/*
 * GET por código de reserva. Lo usa recepción para cobrar las reservaciones
 * hechas desde la app móvil cuando el cliente da su código (NU-XXXXX).
 */
app.get('/api/reservas/codigo/:codigo', adminORecepcion, async (req, res) => {
  const codigo = normalizarCodigoReserva(req.params.codigo);
  if (!codigo) {
    return res.status(400).json({ error: 'El código de reserva no es válido. Ejemplo: NU-48213' });
  }
  try {
    const reserva = await reservasAdmin.porCodigo(req.headers.authorization, codigo);
    res.json(decorarReserva(reserva));
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ error: `No existe una reservación con el código ${codigo}.` });
    responderError(res, error, 'No se pudo consultar la reservación.');
  }
});

//POST para registrar una reservacion nueva (socio registrado o visitante)
app.post('/api/reservas', adminORecepcion, async (req, res) => {
  // 'price' NO se usa: el precio lo calcula el servidor con la tarifa de la
  // clase. Solo se aceptan 'client', 'type', 'class', 'time', 'fecha',
  // 'horarioId' y 'origen' ('recepcion' o 'app').
  const { client, type, class: clase, time, fecha, horarioId, clienteId } = req.body ?? {};
  const origen = req.body?.origen === undefined ? 'recepcion' : req.body.origen;
  if (origen !== 'recepcion' && origen !== 'app') {
    return res.status(400).json({ error: "El origen debe ser 'recepcion' o 'app'." });
  }

  //validacion 1 el nombre del cliente es obligatorio
  if (typeof client !== 'string' || client.trim().length < 3) {
    return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
  }

  //validacion 2 el tipo debe ser socio registrado o visitante
  if (type !== 'cliente' && type !== 'visitante') {
    return res.status(400).json({ error: 'El tipo debe ser cliente o visitante.' });
  }

  //validacion 3 el nombre de la clase es obligatorio (las clases viven en administrativa)
  if (typeof clase !== 'string' || clase.trim().length === 0) {
    return res.status(400).json({ error: 'La clase es obligatoria.' });
  }

  //validacion 4 la hora (HH:MM) y la fecha (YYYY-MM-DD) son obligatorias y
  //no pueden estar en el pasado.
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({ error: 'El horario no es valido.' });
  }
  const [horas, minutos] = time.split(':').map(Number);
  if (horas > 23 || minutos > 59) return res.status(400).json({ error: 'El horario debe estar entre 00:00 y 23:59.' });

  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'La fecha es obligatoria (YYYY-MM-DD).' });
  }
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const fechaObj = new Date(anio, mes - 1, dia);
  if (fechaObj.getFullYear() !== anio || fechaObj.getMonth() !== mes - 1 || fechaObj.getDate() !== dia) {
    return res.status(400).json({ error: 'La fecha no es valida.' });
  }
  const ahora = new Date();
  const fechaHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  if (fechaObj.getTime() < fechaHoy.getTime()) {
    return res.status(400).json({ error: 'La fecha no puede ser anterior a hoy.' });
  }
  if (fechaObj.getTime() === fechaHoy.getTime()) {
    const claseHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), horas, minutos);
    if (claseHoy.getTime() < ahora.getTime()) {
      return res.status(409).json({ error: `La clase de las ${time} ya paso, elige otro horario.` });
    }
  }

  //validacion 5 el horario real: la clase + hora deben coincidir exactamente
  //con un horario activo de administracion para esa fecha.
  let horarioActivo = null;
  let claseReal = null;
  try {
    const encontrado = await buscarHorarioActivo(fecha, { horarioId, clase: clase.trim(), time }, req.headers.authorization);
    horarioActivo = encontrado.horario;
    claseReal = encontrado.clase;
  } catch (err) {
    console.error('No se pudieron validar los horarios de administrativa:', err);
    return res.status(500).json({ error: 'No se pudieron validar los horarios disponibles.' });
  }
  if (!horarioActivo) {
    return res.status(409).json({
      error: `No hay un horario activo de "${clase.trim()}" a las ${time} el ${fecha}. Elige un horario disponible en el modulo Horarios.`,
    });
  }
  if (horarioActivo.nombreClase !== clase.trim() || horarioActivo.horaInicio !== time) {
    return res.status(409).json({ error: 'La sesión seleccionada ya no coincide con la clase y hora enviadas.' });
  }
  if (!claseReal) {
    return res.status(409).json({
      error: `La clase "${clase.trim()}" del horario del ${fecha} ya no existe en el modulo Clases.`,
    });
  }

  //validacion 6 el cliente: se busca en administrativa (fuente unica de clientes) y debe estar
  //activo. Las reglas de tarifa, cupo, lista de espera y limite de reservaciones activas las aplica
  //administrativa al crear la reservacion; aqui solo se revisa si una membresia comprada cubre la clase.
  let nombreCliente = client.trim();
  if (type === 'cliente') {
    if (!clientesAdmin.esIdCliente(clienteId)) {
      return res.status(400).json({ error: 'Selecciona un cliente registrado.' });
    }
    let socio;
    try {
      socio = await clientesAdmin.obtenerSocio(clienteId, req.headers.authorization);
    } catch (error) {
      return res.status(error.status || 503).json({ error: error.message });
    }
    if (!socio) return res.status(404).json({ error: 'El cliente seleccionado no existe.' });
    nombreCliente = socio.nombre;
    if (!socio.activo) {
      return res.status(409).json({ error: `El cliente "${client.trim()}" esta inactivo. Registralo como visitante para continuar.` });
    }
  }

  try {
    // Si el cliente tiene una membresía comprada y vigente que cubre la clase, administrativa la usa sola
    // (precio 0, ya pagada); si no, la reservación queda pendiente de cobro.
    const nueva = await reservasAdmin.crear(req.headers.authorization, {
      tipo: type,
      idCliente: type === 'cliente' ? clienteId : undefined,
      nombreCliente,
      idHorario: horarioActivo.idHorario,
      origen,
    });
    res.status(201).json({
      mensaje: nueva.capacityStatus === 'espera'
        ? `Sesión llena: cliente agregado a la lista de espera. Código: ${nueva.codigo}.`
        : nueva.paymentStatus === 'pagado'
          ? `Reservación confirmada con su membresía. Código: ${nueva.codigo}.`
          : `Reservación confirmada. Código: ${nueva.codigo}.`,
      reservacion: decorarReserva(nueva),
    });
  } catch (error) {
    responderError(res, error, 'No se pudo registrar la reservación.');
  }
});

/*
 * PATCH para cambiar el estatus de una reservación (soft delete). NO se borra
 * el registro: se marca 'cancelado' o 'asistido' para conservar el historial.
 * Las reglas (pago previo, mismo día, lista de espera) las aplica administrativa.
 */
app.patch('/api/reservas/:id', adminORecepcion, async (req, res) => {
  const id = String(req.params.id);
  if (!ID_RESERVA.test(id)) {
    return res.status(400).json({ error: 'El id de la reservación no es válido.' });
  }
  const { status } = req.body ?? {};
  if (status !== 'cancelado' && status !== 'asistido') {
    return res.status(400).json({ error: "El estado debe ser 'cancelado' o 'asistido'." });
  }

  try {
    if (status === 'asistido') {
      const reserva = await reservasAdmin.asistencia(req.headers.authorization, id);
      return res.json({ mensaje: 'Asistencia confirmada.', reservacion: decorarReserva(reserva), promovida: null });
    }
    const { reservacion, promovida } = await reservasAdmin.cancelar(req.headers.authorization, id);
    const sinReembolso = reservacion.paymentStatus === 'pagado' ? ' El pago no se reembolsa.' : '';
    res.json({
      mensaje: promovida
        ? `Reservación cancelada.${sinReembolso} ${promovida.client} subió de la lista de espera.`
        : `Reservación cancelada.${sinReembolso}`,
      reservacion: decorarReserva(reservacion),
      promovida: decorarReserva(promovida),
    });
  } catch (error) {
    responderError(res, error, 'No se pudo actualizar la reservación.');
  }
});

/*
 * Reagendar sin costo: una sola vez, a otro horario de la MISMA clase, con lugar disponible.
 * Conserva el código y no consume otro acceso de la membresía.
 */
app.post('/api/reservas/:id/reagendar', adminORecepcion, async (req, res) => {
  const id = String(req.params.id);
  if (!ID_RESERVA.test(id)) {
    return res.status(400).json({ error: 'El id de la reservación no es válido.' });
  }
  const { horarioId, fecha } = req.body ?? {};
  if (typeof horarioId !== 'string' || !horarioId.trim()) {
    return res.status(400).json({ error: 'Elige el nuevo horario.' });
  }
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'La fecha del nuevo horario es obligatoria (YYYY-MM-DD).' });
  }

  try {
    const actual = await reservasAdmin.porId(req.headers.authorization, id);
    const reglas = reglasDeReserva(actual);
    if (reglas.motivoNoReagendar) {
      return res.status(409).json({ error: reglas.motivoNoReagendar });
    }
    if (actual.horarioId === horarioId.trim()) {
      return res.status(409).json({ error: 'Elige un horario distinto al que ya tiene reservado.' });
    }

    const destino = await buscarHorarioActivo(fecha, { horarioId: horarioId.trim() }, req.headers.authorization);
    const nuevoHorario = destino.horario;
    if (!nuevoHorario) {
      return res.status(409).json({ error: `El horario elegido no existe o no está activo el ${fecha}.` });
    }
    if (nuevoHorario.nombreClase !== actual.class) {
      return res.status(409).json({ error: `Solo se puede reagendar a otro horario de la misma clase ("${actual.class}").` });
    }

    // Si la reserva usa una membresía comprada, administrativa valida que el nuevo horario caiga en su vigencia y clases.

    const { reservacion, promovida } = await reservasAdmin.reagendar(req.headers.authorization, id, nuevoHorario.idHorario);
    res.json({
      mensaje: `Reservación reagendada sin costo al ${reservacion.fecha} a las ${reservacion.time}. Ya no se podrá volver a reagendar.`,
      reservacion: decorarReserva(reservacion),
      promovida: decorarReserva(promovida),
    });
  } catch (error) {
    responderError(res, error, 'No se pudo reagendar la reservación.');
  }
});

/*
 * Clientes: ya no existen endpoints de clientes en cobro. La fuente única es MongoDB y todos los
 * módulos (cobro, administrativa y app móvil) usan /admin/api/clientes.
 */

//GET para el dropdown del modal de reservas
app.get('/api/clases', adminORecepcion, async (req, res) => {
  const resultado = await pool.query(
    'SELECT id, nombre, precio::float8 AS precio FROM webcobro.clases ORDER BY id',
  );
  res.json(resultado.rows);
});

//POST para cobrar una reservación desde el modal de cobro del dashboard.
//
// Recibe el id de la RESERVA (no el del cliente) y la forma de pago, con las
// mismas tres opciones que el Punto de Venta: efectivo, tarjeta o transferencia.
// En una sola transacción:
//   1) bloquea la reservación (FOR UPDATE) para que nadie la cobre dos veces,
//   2) registra el pago en webcobro.pagos junto con su forma de pago,
//   3) marca la reservación como 'pagado'.
// El monto se toma del precio real guardado en la reservación, no del navegador.
app.post('/api/cobros', soloRecepcion, async (req, res) => {
  const reservaId = String(req.body?.reservaId ?? '').trim();
  const metodoPago = String(req.body?.metodoPago ?? 'efectivo');
  const usuario =
    typeof req.body?.usuario === 'string' && req.body.usuario.trim()
      ? req.body.usuario.trim().slice(0, 120)
      : null;

  // Las mismas formas de pago que acepta el Punto de Venta.
  const METODOS_PAGO = ['efectivo', 'tarjeta', 'transferencia'];

  //validacion 1 el id de la reservación es obligatorio
  if (!ID_RESERVA.test(reservaId)) {
    return res.status(400).json({ error: 'El id de la reservación es obligatorio.' });
  }

  //validacion 2 la forma de pago debe ser una de las tres que maneja el sistema
  if (!METODOS_PAGO.includes(metodoPago)) {
    return res.status(400).json({ error: 'La forma de pago no es válida.' });
  }

  //validacion 3 el efectivo recibido solo aplica cuando se paga en efectivo
  const efectivoRecibido =
    req.body?.efectivoRecibido === undefined || req.body?.efectivoRecibido === null
      ? undefined
      : Number(req.body.efectivoRecibido);
  if (metodoPago === 'efectivo') {
    if (efectivoRecibido === undefined || !Number.isFinite(efectivoRecibido) || efectivoRecibido < 0) {
      return res.status(400).json({ error: 'El efectivo recibido no es válido.' });
    }
  }

  // La referencia de la transferencia es opcional y solo aplica a transferencia.
  const referencia =
    metodoPago === 'transferencia' && req.body?.referencia !== undefined && req.body?.referencia !== null
      ? String(req.body.referencia).trim()
      : null;

  let reserva;
  try {
    //validacion 4 la reservación debe existir (vive en administrativa)
    reserva = await reservasAdmin.porId(req.headers.authorization, reservaId);
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ error: 'Reservación no encontrada.' });
    return responderError(res, error, 'No se pudo consultar la reservación.');
  }

  //validacion 5 solo se puede cobrar una reservación pendiente
  if (reserva.paymentStatus === 'pagado') {
    return res.status(400).json({ error: 'Esta reservación ya fue cobrada.' });
  }
  if (reserva.status === 'cancelado') {
    return res.status(400).json({ error: 'No se puede cobrar una reservación cancelada.' });
  }
  if (reserva.status === 'no_asistio') {
    return res.status(409).json({ error: 'El cliente no asistió a esta clase: la reservación ya no se puede cobrar.' });
  }
  if (reserva.capacityStatus === 'espera') {
    return res.status(409).json({ error: 'No se puede cobrar una reservación que sigue en lista de espera.' });
  }
  if (reserva.type === 'cliente' && !reserva.clienteId) {
    return res.status(409).json({ error: 'Reserva antigua sin cliente identificado: requiere conciliacion antes de cobrar.' });
  }

  const monto = Number(reserva.price);

  //validacion 6 en efectivo, el cliente debe alcanzar el monto a cobrar
  if (metodoPago === 'efectivo' && efectivoRecibido < monto) {
    return res.status(400).json({ error: 'El efectivo recibido no alcanza para cubrir el monto.' });
  }

  // El cambio solo existe cuando se paga en efectivo de más (igual que el POS).
  const cambio = metodoPago === 'efectivo' ? Math.max(efectivoRecibido - monto, 0) : null;

  const COLUMNAS_PAGO = `id, folio, monto::float8 AS monto, metodo_pago,
                   efectivo_recibido::float8 AS efectivo_recibido,
                   cambio::float8 AS cambio, referencia, usuario, creado_en`;

  // 1) El pago se guarda primero en cobro (es el registro del dinero). Una reservación solo admite un pago
  //    (índice único por reserva_ref): si un intento anterior quedó a medias, se retoma ese mismo pago.
  let nuevoPago;
  const conexion = await pool.connect();
  try {
    await conexion.query('BEGIN');
    /*
     * Folio diario basado en la fecha de PostgreSQL, no en el reloj del navegador.
     * El bloqueo transaccional serializa únicamente la generación de folios del
     * mismo día, de modo que dos cobros simultáneos no puedan recibir el mismo.
     * Formato conservado de la implementación de Carlos: NCC-AAAAMMDD-0001.
     */
    const fechaFolio = (
      await conexion.query(
        `SELECT to_char(CURRENT_DATE, 'YYYYMMDD') AS fecha,
                hashtext('webcobro-folio-' || CURRENT_DATE::text) AS lock_id`,
      )
    ).rows[0];
    await conexion.query('SELECT pg_advisory_xact_lock($1)', [fechaFolio.lock_id]);

    const consecutivo = (
      await conexion.query(
        `SELECT COALESCE(MAX((regexp_match(folio, '-([0-9]+)$'))[1]::int), 0) + 1 AS numero
           FROM webcobro.pagos
          WHERE folio LIKE $1`,
        [`NCC-${fechaFolio.fecha}-%`],
      )
    ).rows[0].numero;
    const folio = `NCC-${fechaFolio.fecha}-${String(consecutivo).padStart(4, '0')}`;

    nuevoPago = (
      await conexion.query(
        `INSERT INTO webcobro.pagos
           (reserva_ref, cliente_ref, cliente_nombre, monto, metodo_pago,
            efectivo_recibido, cambio, referencia, folio, usuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING ${COLUMNAS_PAGO}`,
        [
          reserva.id,
          reserva.clienteId,
          reserva.client,
          monto,
          metodoPago,
          metodoPago === 'efectivo' ? efectivoRecibido : null,
          cambio,
          referencia,
          folio,
          usuario,
        ],
      )
    ).rows[0];
    await conexion.query('COMMIT');
  } catch (error) {
    await conexion.query('ROLLBACK');
    if (error.code === '23505') {
      // Ya había un pago de esta reservación (el intento anterior no alcanzó a marcarla como pagada).
      nuevoPago = (await pool.query(`SELECT ${COLUMNAS_PAGO} FROM webcobro.pagos WHERE reserva_ref = $1`, [reserva.id])).rows[0];
    }
    if (!nuevoPago) {
      console.error('Error al registrar el cobro:', error);
      return res.status(500).json({ error: 'No se pudo registrar el cobro.' });
    }
  } finally {
    conexion.release();
  }

  // 2) Se marca la reservación como pagada en administrativa, para que la vean todos los módulos.
  let reservaPagada;
  try {
    reservaPagada = await reservasAdmin.pago(req.headers.authorization, reserva.id, {
      metodoPago: nuevoPago.metodo_pago,
      folioPago: nuevoPago.folio,
    });
  } catch (error) {
    console.error('El cobro quedó registrado pero no se pudo marcar la reservación:', error);
    return res.status(error.status || 502).json({
      error: `El cobro se registró con el folio ${nuevoPago.folio}, pero no se pudo actualizar la reservación (${error.message}). Vuelve a intentar el cobro: no se duplicará.`,
    });
  }

  const fechaPago = new Date(nuevoPago.creado_en);
  const ticket = {
    folio: nuevoPago.folio,
    fecha: fechaPago.toISOString(),
    cliente: reserva.client,
    reservaId: reserva.id,
    codigo: reserva.codigo,
    clase: reserva.class,
    fechaClase: reserva.fecha,
    horaClase: reserva.time,
    usuario: nuevoPago.usuario,
    metodoPago: nuevoPago.metodo_pago,
    total: nuevoPago.monto,
    efectivoRecibido: nuevoPago.efectivo_recibido,
    cambio: nuevoPago.cambio,
    referencia: nuevoPago.referencia,
    items: [
      {
        descripcion: reserva.class || 'Clase de gimnasio',
        cantidad: 1,
        precioUnitario: nuevoPago.monto,
        importe: nuevoPago.monto,
      },
    ],
  };

  // El pago ya está confirmado. La impresora es opcional y se atiende aparte.
  void imprimirTicket(ticket).then((enviado) => {
    if (process.env.TICKET_IMPRESION_HABILITADA === 'true' && !enviado) {
      console.warn('Cobro registrado; no se pudo enviar el comprobante a la impresora.');
    }
  }).catch((error) => console.error('Fallo de impresión:', error.message));

  res.status(201).json({
    mensaje: 'Cobro registrado',
    reserva: decorarReserva(reservaPagada),
    ticket,
    pago: {
      id: Number(nuevoPago.id),
      folio: nuevoPago.folio,
      reservaId: reserva.id,
      monto: nuevoPago.monto,
      metodoPago: nuevoPago.metodo_pago,
      efectivoRecibido: nuevoPago.efectivo_recibido,
      cambio: nuevoPago.cambio,
      referencia: nuevoPago.referencia,
      usuario: nuevoPago.usuario,
      fecha: fechaPago.toISOString(),
    },
  });
});

//GET para tarjetas superiores del dashboard
app.get('/api/kpis', adminORecepcion, async (req, res) => {
  let delDia;
  try {
    delDia = await reservasAdmin.listar(req.headers.authorization, { fecha: hoyLocal() });
  } catch (error) {
    return responderError(res, error, 'No se pudieron consultar las reservaciones del día.');
  }
  const confirmadas = delDia.filter((r) => r.capacityStatus === 'confirmada');
  const pendientes = confirmadas.filter((r) => r.status === 'pendiente').length;
  const total = confirmadas.filter((r) => !ESTADOS_INACTIVOS.includes(r.status)).length;

  const ingresosHoy = (
    await pool.query(
      `SELECT COALESCE(SUM(monto), 0)::float8 AS total
         FROM webcobro.pagos
        WHERE creado_en::date = CURRENT_DATE`,
    )
  ).rows[0].total;

  res.json({
    clientesEsperados: pendientes,
    ingresosHoy,
    totalReservas: total,
  });
});

// Asistencia adaptada del commit 948c1a5, aislada del cobro y las reservas.
const { montarAsistencia } = require('./asistenciaService');
const { accesoChecador } = require('./accesoChecador');
app.get('/api/checador/acceso', accesoChecador, (_req, res) => res.json({ autorizado: true }));
app.use('/api/asistencia', accesoChecador);
const asistencia = montarAsistencia(app, pool, {
  turnosHabilitados: process.env.ASISTENCIA_TURNOS_HABILITADOS === 'true',
  // El acceso al checador (administrador o usuarios autorizados) lo valida accesoChecador.js más arriba.
  clientesAdmin,
});
if (process.env.ASISTENCIA_TURNOS_HABILITADOS === 'true' &&
  process.env.ASISTENCIA_FALTAS_AUTOMATICAS === 'true') {
  let revisando = false;
  const timer = setInterval(async () => {
    if (revisando) return;
    revisando = true;
    try { await asistencia.registrarInasistencias(); }
    catch (error) { console.error('Revisión de inasistencias:', error.message); }
    finally { revisando = false; }
  }, 60000);
  timer.unref();
}

//Iniciar Servidor
app.use((error, _req, res, _next) => {
  if (error.code === '23505') return res.status(409).json({ error: 'El código de usuario o correo ya está en uso por otro cliente.' });
  if (error.code === '42703') return res.status(503).json({ error: 'Falta aplicar la migración de códigos de cliente. Contacta al administrador.' });
  if (error.code === '23514') return res.status(400).json({ error: 'El código de usuario no es válido o está reservado.' });
  console.error('Error en Cobro:', error.message);
  res.status(error.status || 500).json({ error: error.status === 400 ? 'Solicitud inválida.' : 'No se pudo completar la operación.' });
});
const PORT = Number(process.env.PORT) || 3002;

// Exporta la app para que el gateway unificado pueda montarla bajo su prefijo
// (/cobro) en un solo puerto. Con GATEWAY_MODE no abre su propio puerto y un
// fallo de PostgreSQL solo afecta a esta seccion: no apaga el proceso completo.
module.exports = app;

/*
 * Al arrancar se aplica db/schema.sql (es idempotente: solo agrega lo que
 * falte) para que las columnas nuevas de la Release 1.2.0 existan sin tener
 * que correr `npm run db:setup` a mano. Se usa la consulta sin bitácora para
 * no imprimir todo el esquema en la terminal.
 */
const aplicarEsquema = async () => {
  await consultaOriginal(fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8'));
  await consultaOriginal(fs.readFileSync(path.join(__dirname, 'db', 'codigo-cliente.sql'), 'utf8'));
  await consultaOriginal(fs.readFileSync(path.join(__dirname, 'db', 'menores-clientes.sql'), 'utf8'));
  await consultaOriginal(fs.readFileSync(path.join(__dirname, 'db', 'codigos-reservas.sql'), 'utf8'));
};

// Revisa cada minuto las clases que ya pasaron para marcar inasistencias,
// aunque nadie tenga abierta la pantalla de recepción.
const iniciarRevisionInasistencias = () => {
  setInterval(() => {
    marcarInasistencias({ query: consultaOriginal })
      .then((n) => { if (n > 0) console.log(`Inasistencias marcadas: ${n}`); })
      .catch((error) => console.error('No se pudieron marcar inasistencias:', error.message));
  }, 60 * 1000).unref();
};

// Comprueba la conexion antes de escuchar peticiones.
pool.query('SELECT 1')
  .then(aplicarEsquema)
  .then(() => {
    iniciarRevisionInasistencias();
    if (process.env.GATEWAY_MODE) {
      console.log('API cobro conectada a PostgreSQL (gateway unificado)');
      return;
    }
    app.listen(PORT, () => {
      console.log(`Backend corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    if (process.env.GATEWAY_MODE) {
      console.error('PostgreSQL no disponible; la seccion de cobro fallara:', error.message);
      return;
    }
    console.error('No se pudo conectar a PostgreSQL:', error.message);
    process.exit(1);
  });