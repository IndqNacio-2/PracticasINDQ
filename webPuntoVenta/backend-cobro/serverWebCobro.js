// Backend de la aplicación web de cobro (front desk).
//
// Antes guardaba todo en arreglos en memoria; ahora usa el PostgreSQL
// compartido de la carpeta de punto de venta, dentro del esquema webcobro.
// Los campos de las respuestas se mantienen igual que antes (client, class,
// time, status, price) para que las pantallas sigan funcionando sin cambios.
require('dotenv/config');

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

app.use(cors()); //permite que react hable con este backend
app.use(express.json());

// El panel administrativo se sirve por este mismo gateway (monto /admin/api) en
// el mismo puerto 3000 que este backend de cobro, por lo que la llamada es
// interna y no atraviesa el navegador. Cada POST /api/reservas consulta estos
// horarios para garantizar que la clase + hora elegida existe de verdad.
const ADMIN_API = 'http://localhost:3000/admin/api';

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

// Bitacora de consultas: imprime cada SQL con la hora que llega a PostgreSQL,
// para que la terminal del backend muestre los SELECT, INSERT, UPDATE y
// DELETE que se ejecutan al usar la aplicacion.
const consultaOriginal = pool.query.bind(pool);
pool.query = (texto, parametros) => {
  if (typeof texto === 'string') {
    const sql = texto.replace(/\s+/g, ' ').trim();
    const hora = new Date().toLocaleTimeString('es-MX');
    const datos = parametros && parametros.length
      ? ` -- datos: ${JSON.stringify(parametros)}`
      : '';
    console.log(`[SQL ${hora}] ${sql}${datos}`);
  }
  return consultaOriginal(texto, parametros);
};

//Modulo para recepcion y cobro

//GET para las reservas
app.get('/api/reservas', async (req, res) => {
  const resultado = await pool.query(
    `SELECT id, cliente AS client, tipo AS type, clase AS class, hora AS time,
            estado AS status, precio::float8 AS price, fecha AS fecha,
            horario_id AS "horarioId", estado_cupo AS "capacityStatus"
       FROM webcobro.reservas
      ORDER BY id`,
  );
  res.json(resultado.rows);
});

//POST para registrar una reservacion nueva (socio registrado o visitante)
app.post('/api/reservas', async (req, res) => {
  // 'price' NO se usa: el precio lo calcula el servidor con la tarifa de la
  // clase (ver validacion 7). Solo se aceptan 'client', 'type', 'class',
  // 'time' y 'fecha'.
  const { client, type, class: clase, time, fecha, horarioId } = req.body ?? {};

  //validacion 1 el nombre del cliente es obligatorio
  if (typeof client !== 'string' || client.trim().length < 3) {
    return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
  }

  //validacion 2 el tipo debe ser socio registrado o visitante
  if (type !== 'cliente' && type !== 'visitante') {
    return res.status(400).json({ error: 'El tipo debe ser cliente o visitante.' });
  }

  //validacion 3 el nombre de la clase es obligatorio. Ya NO se valida contra
  //webcobro.clases: las clases se registran en el modulo administrativo
  //(MongoDB) y el frontend envia el nombre de la clase elegida alli.
  if (typeof clase !== 'string' || clase.trim().length === 0) {
    return res.status(400).json({ error: 'La clase es obligatoria.' });
  }

  //validacion 4 la hora (HH:MM) y la fecha (YYYY-MM-DD) son obligatorias y
  //no pueden estar en el pasado. La fecha coincide con un horario real de
  //administrativa; no se puede inventar una fecha.
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({ error: 'El horario no es valido.' });
  }
  const [horas, minutos] = time.split(':').map(Number);

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

  //validacion 6 el horario real: la clase + hora deben coincidir exactamente
  //con un horario activo de administracion para esa fecha. Si no existe
  //ningun horario para esa fila, la reservacion no se acepta.
  let horarioActivo = null;
  let claseReal = null;
  try {
    // Los horarios dicen en que clase y salon se da la sesion y cuantas
    // plazas tiene; las clases traen el precio y la capacidad maxima.
    const [resHorarios, resClases] = await Promise.all([
      fetch(`${ADMIN_API}/horarios?fecha=${encodeURIComponent(fecha)}&estatus=activo`),
      fetch(`${ADMIN_API}/clases`),
    ]);
    if (!resHorarios.ok) {
      throw new Error(`horarios HTTP ${resHorarios.status}`);
    }
    if (!resClases.ok) {
      throw new Error(`clases HTTP ${resClases.status}`);
    }

    const horarios = await resHorarios.json();
    const clases = await resClases.json();

    horarioActivo = Array.isArray(horarios)
      ? horarios.find((h) =>
          typeof horarioId === 'string' && horarioId
            ? h.idHorario === horarioId
            : h.nombreClase === clase.trim() && h.horaInicio === time
        )
      : null;

    // La clase del horario es la que manda: el precio y la capacidad salen de
    // ella, no de lo que mande el navegador.
    claseReal = Array.isArray(clases)
      ? clases.find((c) => c.idClase === horarioActivo?.idClase)
      : null;
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

  //validacion 7 membresia del socio. Si es "cliente" se busca en
  //webcobro.clientes para validar que este activo y vigente y definir si es
  //Premium (no paga). El precio se define AQUI en el servidor, con la tarifa
  //de la clase del catalogo de administrativa; NO se confia en el que manda
  //el navegador. El visitante siempre paga la tarifa.
  const monto = Number(claseReal.precio ?? 0);
  if (!Number.isFinite(monto) || monto < 0) {
    return res.status(409).json({
      error: `La clase "${clase.trim()}" no tiene un precio valido. Corrigela en el modulo Clases.`,
    });
  }

  let precioFinal = monto;
  if (type === 'cliente') {
    const socio = (
      await pool.query(
        `SELECT nombre, membresia, activo, to_char(vigencia_hasta, 'YYYY-MM-DD') AS vigencia
           FROM webcobro.clientes WHERE nombre = $1`,
        [client.trim()],
      )
    ).rows[0];

    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    const inactivo = socio ? socio.activo === false : false;
    const vencida = socio?.vigencia ? socio.vigencia < hoy : false;

    if (inactivo) {
      return res.status(409).json({ error: `El socio "${client.trim()}" esta inactivo. Registralo como visitante para continuar.` });
    }
    if (vencida) {
      return res.status(409).json({ error: `La membresia de "${client.trim()}" esta vencida. Registralo como visitante para continuar.` });
    }

    // Premium vigente y activo: no paga. El resto paga la tarifa de la clase.
    precioFinal = socio && socio.membresia === 'Premium' ? 0 : monto;
    if (precioFinal <= 0 && socio && socio.membresia !== 'Premium') {
      return res.status(400).json({ error: 'El socio debe pagar la tarifa de la clase.' });
    }
  } else {
    // visitante: siempre paga
    if (monto <= 0) {
      return res.status(400).json({ error: 'El visitante debe pagar la tarifa de la clase.' });
    }
    precioFinal = monto;
  }

  const capacidadTotal = Number(horarioActivo.capacidadTotal || 0);
  const idHorario = horarioActivo.idHorario;
  const listaEsperaHabilitada = horarioActivo.listaEsperaHabilitada === true;
  const LIMITE_RESERVAS = 3;
  const conexion = await pool.connect();
  try {
    await conexion.query('BEGIN');
    // Un bloqueo por sesión serializa la revisión del último lugar y el INSERT.
    await conexion.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`webcobro-horario-${idHorario}`]);

    const duplicada = Number((await conexion.query(
      `SELECT COUNT(*) AS n FROM webcobro.reservas
        WHERE cliente = $1 AND estado <> 'cancelado'
          AND (horario_id = $2 OR (horario_id = '' AND clase = $3 AND fecha = $4 AND hora = $5))`,
      [client.trim(), idHorario, clase.trim(), fecha, time],
    )).rows[0].n);
    if (duplicada > 0) {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: `"${client.trim()}" ya reservo esta sesión de "${clase.trim()}".` });
    }

    const activas = Number((await conexion.query(
      `SELECT COUNT(*) AS n FROM webcobro.reservas
        WHERE cliente = $1 AND estado <> 'cancelado' AND fecha <> ''`,
      [client.trim()],
    )).rows[0].n);
    if (activas >= LIMITE_RESERVAS) {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: `"${client.trim()}" ya tiene ${LIMITE_RESERVAS} reservaciones activas. Cancela una para crear otra.` });
    }

    const confirmadas = Number((await conexion.query(
      `SELECT COUNT(*) AS n FROM webcobro.reservas
        WHERE estado_cupo = 'confirmada' AND estado <> 'cancelado'
          AND (horario_id = $1 OR (horario_id = '' AND clase = $2 AND fecha = $3 AND hora = $4))`,
      [idHorario, clase.trim(), fecha, time],
    )).rows[0].n);
    const cupoLleno = capacidadTotal > 0 && confirmadas >= capacidadTotal;
    if (cupoLleno && !listaEsperaHabilitada) {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: `La clase "${clase.trim()}" a las ${time} no tiene cupo disponible y no admite lista de espera.` });
    }

    const estadoCupo = cupoLleno ? 'espera' : 'confirmada';
    const nueva = (await conexion.query(
      `INSERT INTO webcobro.reservas
         (cliente, tipo, clase, hora, estado, precio, fecha, horario_id, estado_cupo)
       VALUES ($1, $2, $3, $4, 'pendiente', $5, $6, $7, $8)
       RETURNING id, cliente AS client, tipo AS type, clase AS class,
                 hora AS time, estado AS status, precio::float8 AS price, fecha,
                 horario_id AS "horarioId", estado_cupo AS "capacityStatus"`,
      [client.trim(), type, clase.trim(), time, precioFinal, fecha, idHorario, estadoCupo],
    )).rows[0];

    await conexion.query('COMMIT');
    res.status(201).json({
      mensaje: estadoCupo === 'espera'
        ? 'Sesión llena: cliente agregado a la lista de espera.'
        : 'Reservación confirmada.',
      reservacion: nueva,
    });
  } catch (error) {
    await conexion.query('ROLLBACK');
    console.error('No se pudo registrar la reservación:', error);
    res.status(500).json({ error: 'No se pudo registrar la reservación.' });
  } finally {
    conexion.release();
  }
});
//GET para clientes para llenar tabla del dashboard
app.get('/api/clientes', async (req, res) => {
  const resultado = await pool.query(
    `SELECT id, nombre, membresia, telefono, correo, activo,
            to_char(vigencia_hasta, 'YYYY-MM-DD') AS vigencia_hasta
       FROM webcobro.clientes ORDER BY id`,
  );
  res.json(resultado.rows);
});

/*
 * POST para registrar un cliente nuevo (socio). Lo usa el módulo
 * administrativo: queda en webcobro.clientes y aparece al instante en cobro.
 */
app.post('/api/clientes', async (req, res) => {
  const { nombre, membresia, telefono, correo, activo, vigencia_hasta } = req.body ?? {};

  if (typeof nombre !== 'string' || nombre.trim().length < 3) {
    return res.status(400).json({ error: 'El nombre del cliente es obligatorio (mínimo 3 letras).' });
  }

  const plan = typeof membresia === 'string' && membresia.trim() ? membresia.trim() : 'Básica';
  if (!['Básica', 'Premium'].includes(plan)) {
    return res.status(400).json({ error: 'La membresía debe ser Básica o Premium.' });
  }

  const correoLimpio = typeof correo === 'string' ? correo.trim().toLowerCase() : '';
  if (correoLimpio) {
    const duplicado = (
      await pool.query(`SELECT id FROM webcobro.clientes WHERE LOWER(correo) = $1`, [correoLimpio])
    ).rows[0];
    if (duplicado) {
      return res.status(409).json({ error: 'Ya existe un cliente registrado con ese correo.' });
    }
  }

  const tel = typeof telefono === 'string' ? telefono.trim() : '';
  const vig = typeof vigencia_hasta === 'string' ? vigencia_hasta : '';
  const nuevo = (
    await pool.query(
      `INSERT INTO webcobro.clientes (nombre, membresia, telefono, correo, activo, vigencia_hasta)
       VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::date)
       RETURNING id, nombre, membresia, telefono, correo, activo,
                 to_char(vigencia_hasta, 'YYYY-MM-DD') AS vigencia_hasta`,
      [nombre.trim(), plan, tel, correoLimpio || null, activo === false ? false : true, vig],
    )
  ).rows[0];

  res.status(201).json({ mensaje: 'Cliente registrado', cliente: nuevo });
});

/*
 * PATCH para cambiar el estatus de una reservación (soft delete). NO se borra
 * el registro: se marca 'cancelado' o 'asistido' para conservar el historial.
 * El tablero de cobro oculta las canceladas y el módulo administrativo las
 * lista en sus filtros ("Canceladas" / "Asistidas").
 */
app.patch('/api/reservas/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'El id de la reservación no es válido.' });
  }

  // Estatus que se permite cambiar desde fuera: cancelar o confirmar asistencia.
  const { status } = req.body ?? {};
  if (status !== 'cancelado' && status !== 'asistido') {
    return res.status(400).json({ error: "El estatus debe ser 'cancelado' o 'asistido'." });
  }

  const conexion = await pool.connect();
  try {
    await conexion.query('BEGIN');
    const existente = (await conexion.query(
      `SELECT id, estado, estado_cupo, horario_id
         FROM webcobro.reservas WHERE id = $1 FOR UPDATE`,
      [id],
    )).rows[0];

    if (!existente) {
      await conexion.query('ROLLBACK');
      return res.status(404).json({ error: 'La reservación no existe.' });
    }
    if (existente.estado === status) {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: status === 'asistido'
        ? 'Este cliente ya tiene asistencia confirmada.'
        : 'La reservación ya estaba cancelada.' });
    }
    if (status === 'asistido' && existente.estado === 'cancelado') {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: 'No se puede confirmar asistencia de una reservación cancelada.' });
    }
    if (status === 'asistido' && existente.estado_cupo === 'espera') {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: 'No se puede confirmar asistencia mientras el cliente siga en lista de espera.' });
    }

    if (existente.horario_id) {
      await conexion.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`webcobro-horario-${existente.horario_id}`]);
    }
    const actualizada = (await conexion.query(
      `UPDATE webcobro.reservas SET estado = $2
        WHERE id = $1
        RETURNING id, cliente AS client, tipo AS type, clase AS class,
                  hora AS time, estado AS status, precio::float8 AS price, fecha,
                  horario_id AS "horarioId", estado_cupo AS "capacityStatus"`,
      [id, status],
    )).rows[0];

    let promovida = null;
    if (status === 'cancelado' && existente.estado_cupo === 'confirmada' && existente.horario_id) {
      promovida = (await conexion.query(
        `UPDATE webcobro.reservas
            SET estado_cupo = 'confirmada'
          WHERE id = (
            SELECT id FROM webcobro.reservas
             WHERE horario_id = $1 AND estado_cupo = 'espera' AND estado <> 'cancelado'
             ORDER BY id
             LIMIT 1
             FOR UPDATE SKIP LOCKED
          )
          RETURNING id, cliente AS client, tipo AS type, clase AS class,
                    hora AS time, estado AS status, precio::float8 AS price, fecha,
                    horario_id AS "horarioId", estado_cupo AS "capacityStatus"`,
        [existente.horario_id],
      )).rows[0] ?? null;
    }

    await conexion.query('COMMIT');
    res.json({
      mensaje: status === 'asistido'
        ? 'Asistencia confirmada'
        : promovida
          ? `Reservación cancelada. ${promovida.client} fue promovido desde la lista de espera.`
          : 'Reservación cancelada.',
      reservacion: actualizada,
      promovida,
    });
  } catch (error) {
    await conexion.query('ROLLBACK');
    console.error('No se pudo actualizar la reservación:', error);
    res.status(500).json({ error: 'No se pudo actualizar la reservación.' });
  } finally {
    conexion.release();
  }
});

/*
 * PATCH para editar un cliente (nombre, membresía, teléfono, correo, activo,
 * vigencia). Lo usa el módulo administrativo; cobro lo refleja al recargar.
 */
app.patch('/api/clientes/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'El id del cliente no es válido.' });
  }

  const existe = (
    await pool.query(`SELECT id FROM webcobro.clientes WHERE id = $1`, [id])
  ).rows[0];
  if (!existe) {
    return res.status(404).json({ error: 'El cliente no existe.' });
  }

  const { nombre, membresia, telefono, correo, activo, vigencia_hasta } = req.body ?? {};
  const campos = [];
  const valores = [];

  if (nombre !== undefined) {
    if (typeof nombre !== 'string' || nombre.trim().length < 3) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio (mínimo 3 letras).' });
    }
    valores.push(nombre.trim());
    campos.push(`nombre = $${valores.length}`);
  }
  if (membresia !== undefined) {
    if (!['Básica', 'Premium'].includes(membresia)) {
      return res.status(400).json({ error: 'La membresía debe ser Básica o Premium.' });
    }
    valores.push(membresia);
    campos.push(`membresia = $${valores.length}`);
  }
  if (telefono !== undefined) {
    valores.push(String(telefono));
    campos.push(`telefono = $${valores.length}`);
  }
  if (correo !== undefined) {
    const limpio = String(correo).trim().toLowerCase();
    if (limpio) {
      const enUso = (
        await pool.query(`SELECT id FROM webcobro.clientes WHERE LOWER(correo) = $1 AND id <> $2`, [limpio, id])
      ).rows[0];
      if (enUso) {
        return res.status(409).json({ error: 'Ese correo ya está en uso por otro cliente.' });
      }
    }
    valores.push(limpio || null);
    campos.push(`correo = $${valores.length}`);
  }
  if (activo !== undefined) {
    valores.push(activo === false ? false : true);
    campos.push(`activo = $${valores.length}`);
  }
  if (vigencia_hasta !== undefined) {
    // '' o null = sin vencimiento (no expira).
    valores.push(typeof vigencia_hasta === 'string' && vigencia_hasta ? vigencia_hasta : null);
    campos.push(`vigencia_hasta = $${valores.length}::date`);
  }

  if (campos.length === 0) {
    return res.status(400).json({ error: 'No hay cambios para guardar.' });
  }

  valores.push(id);
  const actualizado = (
    await pool.query(
      `UPDATE webcobro.clientes SET ${campos.join(', ')} WHERE id = $${valores.length}
       RETURNING id, nombre, membresia, telefono, correo, activo,
                 to_char(vigencia_hasta, 'YYYY-MM-DD') AS vigencia_hasta`,
      valores,
    )
  ).rows[0];

  res.json({ mensaje: 'Cliente actualizado', cliente: actualizado });
});

/*
 * DELETE para borrar un cliente desde el módulo administrativo.
 * Se bloquea si tiene reservaciones o pagos ligados: primero hay que
 * cancelarlas en recepción para no dejar historial huérfano.
 */
app.delete('/api/clientes/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'El id del cliente no es válido.' });
  }

  try {
    const borrado = (
      await pool.query(`DELETE FROM webcobro.clientes WHERE id = $1 RETURNING id`, [id])
    ).rows[0];
    if (!borrado) {
      return res.status(404).json({ error: 'El cliente no existe.' });
    }
    res.json({ mensaje: 'Cliente eliminado' });
  } catch (err) {
    if (err && err.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar: el cliente tiene reservaciones o pagos registrados.' });
    }
    throw err;
  }
});

//GET para el dropdown del modal de reservas
app.get('/api/clases', async (req, res) => {
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
app.post('/api/cobros', async (req, res) => {
  const reservaId = Number(req.body?.reservaId);
  const metodoPago = String(req.body?.metodoPago ?? 'efectivo');
  const usuario =
    typeof req.body?.usuario === 'string' && req.body.usuario.trim()
      ? req.body.usuario.trim().slice(0, 120)
      : null;

  // Las mismas formas de pago que acepta el Punto de Venta.
  const METODOS_PAGO = ['efectivo', 'tarjeta', 'transferencia'];

  //validacion 1 el id de la reservación es obligatorio
  if (!Number.isInteger(reservaId) || reservaId <= 0) {
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

  const conexion = await pool.connect();
  try {
    await conexion.query('BEGIN');

    //validacion 4 la reservación debe existir (bloqueada para el cobro)
    const reserva = (
      await conexion.query(
        `SELECT id, cliente, tipo, clase, hora, fecha, estado, estado_cupo, precio
           FROM webcobro.reservas
          WHERE id = $1
          FOR UPDATE`,
        [reservaId],
      )
    ).rows[0];
    if (!reserva) {
      await conexion.query('ROLLBACK');
      return res.status(404).json({ error: 'Reservación no encontrada.' });
    }

    //validacion 5 solo se puede cobrar una reservación pendiente
    if (reserva.estado === 'pagado') {
      await conexion.query('ROLLBACK');
      return res.status(400).json({ error: 'Esta reservación ya fue cobrada.' });
    }
    if (reserva.estado === 'cancelado') {
      await conexion.query('ROLLBACK');
      return res.status(400).json({ error: 'No se puede cobrar una reservación cancelada.' });
    }
    if (reserva.estado_cupo === 'espera') {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: 'No se puede cobrar una reservación que sigue en lista de espera.' });
    }

    const monto = Number(reserva.precio);

    //validacion 6 en efectivo, el cliente debe alcanzar el monto a cobrar
    if (metodoPago === 'efectivo' && efectivoRecibido < monto) {
      await conexion.query('ROLLBACK');
      return res.status(400).json({ error: 'El efectivo recibido no alcanza para cubrir el monto.' });
    }

    // El cambio solo existe cuando se paga en efectivo de más (igual que el POS).
    const cambio = metodoPago === 'efectivo' ? Math.max(efectivoRecibido - monto, 0) : null;

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

    // El socio puede tener ficha en webcobro.clientes; el visitante no.
    const socio = (
      await conexion.query('SELECT id FROM webcobro.clientes WHERE nombre = $1', [reserva.cliente])
    ).rows[0];

    const nuevoPago = (
      await conexion.query(
        `INSERT INTO webcobro.pagos
           (reserva_id, cliente_id, cliente_nombre, monto, metodo_pago,
            efectivo_recibido, cambio, referencia, folio, usuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, folio, monto::float8 AS monto, metodo_pago,
                   efectivo_recibido::float8 AS efectivo_recibido,
                   cambio::float8 AS cambio, referencia, usuario, creado_en`,
        [
          reserva.id,
          socio ? socio.id : null,
          reserva.cliente,
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

    // Se marca la reservación como pagada y se devuelve con los mismos nombres
    // de campo que GET /api/reservas para que el dashboard la reemplace tal cual.
    const reservaPagada = (
      await conexion.query(
        `UPDATE webcobro.reservas
            SET estado = 'pagado'
          WHERE id = $1
          RETURNING id, cliente AS client, tipo AS type, clase AS class,
                     hora AS time, estado AS status, precio::float8 AS price, fecha,
                     horario_id AS "horarioId", estado_cupo AS "capacityStatus"`,
        [reserva.id],
      )
    ).rows[0];

    await conexion.query('COMMIT');

    const fechaPago = new Date(nuevoPago.creado_en);
    const ticket = {
      folio: nuevoPago.folio,
      fecha: fechaPago.toISOString(),
      cliente: reserva.cliente,
      reservaId: reserva.id,
      clase: reserva.clase,
      fechaClase: reserva.fecha,
      horaClase: reserva.hora,
      usuario: nuevoPago.usuario,
      metodoPago: nuevoPago.metodo_pago,
      total: nuevoPago.monto,
      efectivoRecibido: nuevoPago.efectivo_recibido,
      cambio: nuevoPago.cambio,
      referencia: nuevoPago.referencia,
      items: [
        {
          descripcion: reserva.clase || 'Clase de gimnasio',
          cantidad: 1,
          precioUnitario: nuevoPago.monto,
          importe: nuevoPago.monto,
        },
      ],
    };

    res.status(201).json({
      mensaje: 'Cobro registrado',
      reserva: reservaPagada,
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
  } catch (error) {
    await conexion.query('ROLLBACK');
    console.error('Error al registrar el cobro:', error);
    res.status(500).json({ error: 'No se pudo registrar el cobro.' });
  } finally {
    conexion.release();
  }
});

//GET para tarjetas superiores del dashboard
app.get('/api/kpis', async (req, res) => {
  const resumen = (
    await pool.query(
      `SELECT COUNT(*) FILTER (
                WHERE estado = 'pendiente' AND estado_cupo = 'confirmada' AND fecha = CURRENT_DATE::text
              )::int AS pendientes,
              COUNT(*) FILTER (
                WHERE estado <> 'cancelado' AND estado_cupo = 'confirmada' AND fecha = CURRENT_DATE::text
              )::int AS total
         FROM webcobro.reservas`,
    )
  ).rows[0];

  const ingresosHoy = (
    await pool.query(
      `SELECT COALESCE(SUM(monto), 0)::float8 AS total
         FROM webcobro.pagos
        WHERE creado_en::date = CURRENT_DATE`,
    )
  ).rows[0].total;

  res.json({
    clientesEsperados: resumen.pendientes,
    ingresosHoy,
    totalReservas: resumen.total,
  });
});

//MODULO PARA ASISTENCIA

// Convierte lo que escriban el checador a un codigo normalizado:
// EMP-101 (empleado), CLI-3 o 3 (socio). Devuelve null si no es valido.
const normalizarIdentificador = (valor) => {
  if (/^EMP-\d{3}$/.test(valor)) return valor;
  if (/^CLI-\d+$/.test(valor)) return valor;
  if (/^\d+$/.test(valor)) return `CLI-${valor}`;
  return null;
};

// Consulta la ultima marca de HOY del empleado para saber si le toca
// registrar entrada o salida. Se decide por dia: si hoy ya marco entrada
// le toca salida; si no ha marcado hoy su primera marca es entrada (asi
// quien no cerro la jornada ayer no empieza el dia pidiendo salida).
const proximaMarca = async (codigo) => {
  const ultimaHoy = (
    await pool.query(
      `SELECT tipo, creado_en
         FROM webcobro.asistencias
        WHERE codigo = $1 AND creado_en::date = CURRENT_DATE
        ORDER BY creado_en DESC, id DESC
        LIMIT 1`,
      [codigo],
    )
  ).rows[0];
  return {
    marcoHoy: Boolean(ultimaHoy),
    ultimaHoy: ultimaHoy || null,
    siguienteTipo: ultimaHoy && ultimaHoy.tipo === 'entrada' ? 'salida' : 'entrada',
  };
};

//GET historial de asistencia por codigo (ultimos 10 registros del socio,
//para que el checador vea si ya registro entrada o salida recientemente)
app.get('/api/asistencia/historial/:identificador', async (req, res) => {
  const codigo = normalizarIdentificador((req.params.identificador || '').trim().toUpperCase());
  if (!codigo) {
    return res.status(400).json({ error: 'Formato inválido. Ejemplo: EMP-101 o 3' });
  }

  try {
    const registros = await pool.query(
      `SELECT id, codigo, nombre, tipo, creado_en
         FROM webcobro.asistencias
        WHERE codigo = $1
        ORDER BY creado_en DESC, id DESC
        LIMIT 10`,
      [codigo],
    );

    res.json(
      registros.rows.map((r) => ({
        _id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        tipo: r.tipo,
        fecha: new Date(r.creado_en).toISOString(),
        ts: new Date(r.creado_en).getTime(),
      })),
    );
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

//GET persona por codigo (empleado o socio): valida que exista y devuelve el
//boton que debe mostrar el checador (entrada o salida) segun su ultima marca
//de hoy. Acepta EMP-101, CLI-3 o el id del socio a secas.
app.get('/api/asistencia/empleado/:codigo', async (req, res) => {
  const codigo = normalizarIdentificador((req.params.codigo || '').trim().toUpperCase());

  if (!codigo) {
    return res.status(400).json({ error: 'Formato inválido. Ejemplo: EMP-101' });
  }
  const esEmpleado = codigo.startsWith('EMP-');

  try {
    const persona = esEmpleado
      ? (
          await pool.query(
            'SELECT codigo, nombre, rol FROM webcobro.empleados WHERE codigo = $1',
            [codigo],
          )
        ).rows[0]
      : (
          await pool.query(
            'SELECT id, nombre, membresia FROM webcobro.clientes WHERE id = $1',
            [codigo.slice(4)],
          )
        ).rows[0];
    if (!persona) return res.status(404).json({ error: `Código ${codigo} no registrado` });

    const estadoDia = await proximaMarca(codigo);
    const ultimo = (
      await pool.query(
        `SELECT tipo, creado_en
           FROM webcobro.asistencias
          WHERE codigo = $1
          ORDER BY creado_en DESC, id DESC
          LIMIT 1`,
        [codigo],
      )
    ).rows[0];

    res.json({
      tipo: esEmpleado ? 'empleado' : 'cliente',
      codigo,
      nombre: persona.nombre,
      rol: esEmpleado ? persona.rol : null,
      membresia: esEmpleado ? null : persona.membresia,
      marcoHoy: estadoDia.marcoHoy,
      ultimaMarcaHoy: estadoDia.ultimaHoy ? estadoDia.ultimaHoy.tipo : null,
      siguienteTipo: estadoDia.siguienteTipo, // 'entrada' | 'salida'
      ultimoRegistro: ultimo ? ultimo.tipo : null,
      timestamp: ultimo ? new Date(ultimo.creado_en).toISOString() : null,
    });
  } catch (error) {
    console.error('Error al buscar empleado:', error);
    res.status(500).json({ error: 'Error al buscar empleado' });
  }
});

app.post('/api/asistencia/marcar', async (req, res) => {
  const codigo = normalizarIdentificador((req.body.codigo || '').trim().toUpperCase());

  //validacion 1 formato EMP-XXX (empleado) o CLI-N (socio)
  if (!codigo) {
    return res.status(400).json({ error: 'Formato inválido. Ejemplo: EMP-101' });
  }

  //Validacon 2 : corroboramos existencia del empleado o socio
  const persona = codigo.startsWith('EMP-')
    ? (await pool.query('SELECT codigo, nombre FROM webcobro.empleados WHERE codigo = $1', [codigo])).rows[0]
    : (await pool.query('SELECT id, nombre FROM webcobro.clientes WHERE id = $1', [codigo.slice(4)])).rows[0];
  if (!persona) return res.status(404).json({ error: `Código ${codigo} no registrado` });

  //validacion 3 : antispam (60 seg)
  const ultimo = (
    await pool.query(
      `SELECT tipo, creado_en
         FROM webcobro.asistencias
        WHERE codigo = $1
        ORDER BY creado_en DESC, id DESC
        LIMIT 1`,
      [codigo],
    )
  ).rows[0];
  const tsUltimo = ultimo ? new Date(ultimo.creado_en).getTime() : 0;
  if (ultimo && (Date.now() - tsUltimo) < 60000) {
    return res.status(429).json({ error: 'Espera 1 minuto entre marcas' });
  }

  //logica para entrada y salida: se decide por dia con proximaMarca
  const estadoDia = await proximaMarca(codigo);
  const tipo = estadoDia.siguienteTipo;

  const registro = (
    await pool.query(
      `INSERT INTO webcobro.asistencias (codigo, nombre, tipo)
       VALUES ($1, $2, $3)
       RETURNING id, codigo, nombre, tipo, creado_en`,
      [codigo, persona.nombre, tipo],
    )
  ).rows[0];

  res.json({
    _id: Number(registro.id),
    codigo: registro.codigo,
    nombre: registro.nombre,
    tipo: registro.tipo,
    fecha: new Date(registro.creado_en).toISOString(),
    ts: new Date(registro.creado_en).getTime(),
  });
});

//Iniciar Servidor
const PORT = Number(process.env.PORT) || 3002;

// Exporta la app para que el gateway unificado pueda montarla bajo su prefijo
// (/cobro) en un solo puerto. Con GATEWAY_MODE no abre su propio puerto y un
// fallo de PostgreSQL solo afecta a esta seccion: no apaga el proceso completo.
module.exports = app;

// Comprueba la conexion antes de escuchar peticiones.
pool.query('SELECT 1')
  .then(() => {
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
