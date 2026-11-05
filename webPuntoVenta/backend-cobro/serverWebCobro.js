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
const flujoReservas = require('./reservasFlujo');
const membresiasService = require('./membresiasService');

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

membresiasService.registrarRutas(app, pool, ADMIN_API);

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

// ===================================================================
// Reglas de reservaciones (Release 1.2.0)
// ===================================================================

// Horas que tiene el cliente para cancelar, contadas desde que hizo la
// reservación. Cancelar no genera reembolso.
const VENTANA_CANCELACION_HORAS = 24;
// Estados que ya no apartan lugar ni cuentan como reservación activa.
const ESTADOS_INACTIVOS = ['cancelado', 'no_asistio'];

// Columnas de una reservación con los nombres que usan las pantallas.
const COLUMNAS_RESERVA = `id, cliente AS client, tipo AS type, clase AS class,
  membresia_compra_id AS "membresiaCompraId", clase_id AS "claseId",
  cliente_id AS "clienteId", estado_pago AS "paymentStatus", hora_fin AS "horaFin",
  CASE WHEN estado IN ('asistido', 'no_asistio') THEN estado ELSE 'pendiente' END AS "attendanceStatus",
  hora AS time, estado AS status, precio::float8 AS price, fecha,
  horario_id AS "horarioId", estado_cupo AS "capacityStatus", codigo, origen,
  reagendada, fecha_original AS "fechaOriginal", hora_original AS "horaOriginal",
  creado_en AS "creadoEn"`;

const dosDigitos = (n) => String(n).padStart(2, '0');

// 'YYYY-MM-DD HH:MM' en hora local, comparable como texto con fecha || ' ' || hora.
const marcaLocal = (d) =>
  `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())} ${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;

// Fecha/hora de inicio de la clase (hora local) o null si la reserva no tiene fecha.
const inicioDeClase = (fecha, hora) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '') || !/^\d{2}:\d{2}$/.test(hora || '')) return null;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const [h, m] = hora.split(':').map(Number);
  return new Date(anio, mes - 1, dia, h, m);
};

const MOTIVO_POR_ESTADO = {
  asistido: 'El cliente ya asistió a esta clase.',
  no_asistio: 'El cliente no asistió a su clase: no tiene reembolso y no se puede reagendar.',
  cancelado: 'La reservación ya está cancelada.',
};

/*
 * Decide si una reservación (con los nombres de COLUMNAS_RESERVA) se puede
 * cancelar o reagendar en este momento. Devuelve el motivo cuando no se puede,
 * o null cuando sí. Es la misma regla para recepción y para la app móvil.
 */
const reglasDeReserva = (r, ahora = new Date()) => {
  const inicio = inicioDeClase(r.fecha, r.time);
  const yaInicio = inicio ? inicio.getTime() <= ahora.getTime() : false;
  const creado = r.creadoEn ? new Date(r.creadoEn) : null;
  const cancelableHasta = creado
    ? new Date(creado.getTime() + VENTANA_CANCELACION_HORAS * 3600 * 1000)
    : null;
  const motivoEstado = MOTIVO_POR_ESTADO[r.status] ?? null;

  let motivoNoCancelar = motivoEstado;
  if (!motivoNoCancelar && yaInicio) {
    motivoNoCancelar = 'La clase ya comenzó, ya no se puede cancelar.';
  }
  // La lista de espera no aparta lugar: se puede abandonar en cualquier momento.
  if (!motivoNoCancelar && r.capacityStatus !== 'espera' && cancelableHasta
      && ahora.getTime() > cancelableHasta.getTime()) {
    motivoNoCancelar = `El plazo de ${VENTANA_CANCELACION_HORAS} horas para cancelar venció el ${cancelableHasta.toLocaleString('es-MX')}.`;
  }

  let motivoNoReagendar = motivoEstado;
  if (!motivoNoReagendar && r.reagendada) {
    motivoNoReagendar = 'Esta reservación ya se reagendó una vez; solo se permite reagendar una vez.';
  }
  if (!motivoNoReagendar && yaInicio) {
    motivoNoReagendar = 'La clase ya comenzó, ya no se puede reagendar.';
  }

  return {
    motivoNoCancelar,
    motivoNoReagendar,
    cancelableHasta: cancelableHasta ? cancelableHasta.toISOString() : null,
  };
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
const marcarInasistencias = async (db = pool) => {
  return flujoReservas.marcarInasistencias(db);
};

// Código de reserva legible (sin 0/O ni 1/I para no confundirlos al dictarlo).
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generarCodigoReserva = async (db) => {
  for (let intento = 0; intento < 10; intento += 1) {
    let codigo = 'RSV-';
    for (let i = 0; i < 6; i += 1) {
      codigo += ALFABETO_CODIGO[crypto.randomInt(ALFABETO_CODIGO.length)];
    }
    const existe = (await db.query('SELECT 1 FROM webcobro.reservas WHERE codigo = $1', [codigo])).rowCount;
    if (!existe) return codigo;
  }
  throw new Error('No se pudo generar un código de reserva único.');
};

// Acepta 'rsv-7k2m9q', 'RSV-7K2M9Q' o solo '7K2M9Q'.
const normalizarCodigoReserva = (valor) => {
  const limpio = String(valor ?? '').trim().toUpperCase();
  if (/^RSV-[A-Z0-9]{6}$/.test(limpio)) return limpio;
  if (/^[A-Z0-9]{6}$/.test(limpio)) return `RSV-${limpio}`;
  return null;
};

/*
 * Busca en administrativa el horario activo de una fecha (por id o por
 * clase + hora) y la clase a la que pertenece (precio y capacidad).
 */
const buscarHorarioActivo = async (fecha, { horarioId, clase, time }) => {
  const [resHorarios, resClases] = await Promise.all([
    fetch(`${ADMIN_API}/horarios?fecha=${encodeURIComponent(fecha)}&estatus=activo`),
    fetch(`${ADMIN_API}/clases`),
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
  return { horario, clase: claseReal };
};

// Al liberarse un lugar confirmado, sube a la primera persona en lista de espera.
const promoverListaEspera = async (conexion, horarioId) => (
  await conexion.query(
    `UPDATE webcobro.reservas
        SET estado_cupo = 'confirmada'
      WHERE id = (
        SELECT id FROM webcobro.reservas
         WHERE horario_id = $1 AND estado_cupo = 'espera'
           AND estado NOT IN ('cancelado', 'no_asistio')
         ORDER BY id
         LIMIT 1
         FOR UPDATE SKIP LOCKED
      )
      RETURNING ${COLUMNAS_RESERVA}`,
    [horarioId],
  )
).rows[0] ?? null;

//Modulo para recepcion y cobro

//GET para las reservas
app.get('/api/reservas', async (req, res) => {
  // Antes de listar se marcan las inasistencias de las clases que ya pasaron.
  await marcarInasistencias();
  const resultado = await pool.query(
    `SELECT ${COLUMNAS_RESERVA}
       FROM webcobro.reservas
      ORDER BY id`,
  );
  res.json(resultado.rows.map(decorarReserva));
});

/*
 * GET por código de reserva. Lo usa recepción para cobrar las reservaciones
 * hechas desde la app móvil cuando el cliente da su código (RSV-XXXXXX o solo
 * los 6 caracteres).
 */
app.get('/api/reservas/codigo/:codigo', async (req, res) => {
  const codigo = normalizarCodigoReserva(req.params.codigo);
  if (!codigo) {
    return res.status(400).json({ error: 'El código de reserva no es válido. Ejemplo: RSV-7K2M9Q' });
  }
  await marcarInasistencias();
  const reserva = (
    await pool.query(`SELECT ${COLUMNAS_RESERVA} FROM webcobro.reservas WHERE codigo = $1`, [codigo])
  ).rows[0];
  if (!reserva) {
    return res.status(404).json({ error: `No existe una reservación con el código ${codigo}.` });
  }
  res.json(decorarReserva(reserva));
});

//POST para registrar una reservacion nueva (socio registrado o visitante)
app.post('/api/reservas', async (req, res) => {
  // 'price' NO se usa: el precio lo calcula el servidor con la tarifa de la
  // clase (ver validacion 7). Solo se aceptan 'client', 'type', 'class',
  // 'time', 'fecha', 'horarioId' y 'origen' ('recepcion' o 'app').
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
    // plazas tiene; la clase del horario es la que manda: el precio y la
    // capacidad salen de ella, no de lo que mande el navegador.
    const encontrado = await buscarHorarioActivo(fecha, { horarioId, clase: clase.trim(), time });
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
  let clienteNombre = client.trim();
  if (type === 'cliente') {
    if (!Number.isSafeInteger(clienteId) || clienteId <= 0) {
      return res.status(400).json({ error: 'Selecciona un socio por su ID.' });
    }
    const socio = (
      await pool.query(
        `SELECT nombre, membresia, activo, to_char(vigencia_hasta, 'YYYY-MM-DD') AS vigencia
           FROM webcobro.clientes WHERE id = $1`,
        [clienteId],
      )
    ).rows[0];

    if (!socio) return res.status(404).json({ error: 'El socio seleccionado no existe.' });
    clienteNombre = socio.nombre;
    const inactivo = socio ? socio.activo === false : false;
    const vencida = socio?.vigencia ? socio.vigencia < fecha : false;

    if (inactivo) {
      return res.status(409).json({ error: `El socio "${client.trim()}" esta inactivo. Registralo como visitante para continuar.` });
    }
    if (vencida && !(await pool.query('SELECT 1 FROM webcobro.membresias_compras WHERE cliente_id = $1 LIMIT 1', [clienteId])).rowCount) {
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
    await conexion.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      type === 'cliente' ? `webcobro-cliente-${clienteId}` : `webcobro-visitante-${clienteNombre}`,
    ]);
    if (type === 'cliente') {
      const socioActual = (await conexion.query(
        `SELECT nombre, activo, membresia, to_char(vigencia_hasta, 'YYYY-MM-DD') AS vigencia
           FROM webcobro.clientes WHERE id = $1 FOR SHARE`, [clienteId],
      )).rows[0];
      if (!socioActual || !socioActual.activo) {
        await conexion.query('ROLLBACK');
        return res.status(409).json({ error: 'El socio ya no esta disponible o vigente para la fecha de la sesion.' });
      }
      clienteNombre = socioActual.nombre;
      const tieneCompras = (await conexion.query('SELECT 1 FROM webcobro.membresias_compras WHERE cliente_id = $1 LIMIT 1', [clienteId])).rowCount > 0;
      if (!tieneCompras && socioActual.vigencia && socioActual.vigencia < fecha) {
        await conexion.query('ROLLBACK');
        return res.status(409).json({ error: 'La membresía histórica no está vigente para esta sesión.' });
      }
      // Premium solo conserva compatibilidad para socios aún no migrados.
      precioFinal = !tieneCompras && socioActual.membresia === 'Premium' ? 0 : monto;
      const sinConciliar = await conexion.query(
        `SELECT 1 FROM webcobro.reservas WHERE tipo = 'cliente' AND cliente_id IS NULL
          AND cliente = $1 AND estado IN ('pendiente', 'pagado')
          AND fecha <> '' AND (fecha || ' ' || hora) > $2 LIMIT 1`,
        [clienteNombre, marcaLocal(new Date())],
      );
      if (sinConciliar.rowCount) {
        await conexion.query('ROLLBACK');
        return res.status(409).json({ error: 'Hay reservas antiguas con este nombre sin ID. Concilialas antes de crear otras para evitar limites incorrectos.' });
      }
    }
    // Un bloqueo por sesión serializa la revisión del último lugar y el INSERT.
    await conexion.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`webcobro-horario-${idHorario}`]);

    const duplicada = Number((await conexion.query(
      `SELECT COUNT(*) AS n FROM webcobro.reservas
        WHERE ((cliente_id = $6) OR ($6::integer IS NULL AND tipo = 'visitante' AND cliente = $1)) AND estado NOT IN ('cancelado', 'no_asistio')
          AND (horario_id = $2 OR (horario_id = '' AND clase = $3 AND fecha = $4 AND hora = $5))`,
      [clienteNombre, idHorario, clase.trim(), fecha, time, type === 'cliente' ? clienteId : null],
    )).rows[0].n);
    if (duplicada > 0) {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: `"${client.trim()}" ya reservo esta sesión de "${clase.trim()}".` });
    }

    const activas = Number((await conexion.query(
      `SELECT COUNT(*) AS n FROM webcobro.reservas
        WHERE ((cliente_id = $2) OR ($2::integer IS NULL AND tipo = 'visitante' AND cliente = $1))
          AND estado IN ('pendiente', 'pagado') AND fecha <> '' AND (fecha || ' ' || hora) > $3`,
      [clienteNombre, type === 'cliente' ? clienteId : null, marcaLocal(new Date())],
    )).rows[0].n);
    if (activas >= LIMITE_RESERVAS) {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: `"${client.trim()}" ya tiene ${LIMITE_RESERVAS} reservaciones activas. Cancela una para crear otra.` });
    }

    const confirmadas = Number((await conexion.query(
      `SELECT COUNT(*) AS n FROM webcobro.reservas
        WHERE estado_cupo = 'confirmada' AND estado NOT IN ('cancelado', 'no_asistio')
          AND (horario_id = $1 OR (horario_id = '' AND clase = $2 AND fecha = $3 AND hora = $4))`,
      [idHorario, clase.trim(), fecha, time],
    )).rows[0].n);
    const cupoLleno = capacidadTotal > 0 && confirmadas >= capacidadTotal;
    if (cupoLleno && !listaEsperaHabilitada) {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: `La clase "${clase.trim()}" a las ${time} no tiene cupo disponible y no admite lista de espera.` });
    }

    const estadoCupo = cupoLleno ? 'espera' : 'confirmada';
    const cobertura = type === 'cliente'
      ? await membresiasService.buscarCobertura(conexion, clienteId, claseReal.idClase, fecha) : null;
    if (cobertura) precioFinal = 0;
    // Código de reserva que el cliente presenta en recepción para pagar.
    const codigo = await generarCodigoReserva(conexion);
    let nueva = (await conexion.query(
      `INSERT INTO webcobro.reservas
         (cliente, tipo, clase, hora, estado, precio, fecha, horario_id, estado_cupo, codigo, origen, cliente_id, hora_fin)
       VALUES ($1, $2, $3, $4, 'pendiente', $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING ${COLUMNAS_RESERVA}`,
      [clienteNombre, type, clase.trim(), time, precioFinal, fecha, idHorario, estadoCupo, codigo, origen, type === 'cliente' ? clienteId : null, horarioActivo.horaFin],
    )).rows[0];

    if (cobertura) {
      nueva = (await conexion.query(`UPDATE webcobro.reservas
        SET membresia_compra_id = $2, clase_id = $3, estado_pago = 'pagado', estado = 'pagado'
        WHERE id = $1 RETURNING ${COLUMNAS_RESERVA}`, [nueva.id, cobertura.id, claseReal.idClase])).rows[0];
    }

    await conexion.query('COMMIT');
    res.status(201).json({
      mensaje: estadoCupo === 'espera'
        ? `Sesión llena: cliente agregado a la lista de espera. Código: ${codigo}.`
        : `Reservación confirmada. Código: ${codigo}.`,
      reservacion: decorarReserva(nueva),
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
            EXISTS (SELECT 1 FROM webcobro.membresias_compras mc WHERE mc.cliente_id = webcobro.clientes.id) AS "tieneCompras",
             COALESCE((SELECT jsonb_agg(jsonb_build_object(
               'id', mc.id, 'nombre', mc.condiciones->>'nombre',
               'fechaInicio', to_char(mc.fecha_inicio, 'YYYY-MM-DD'),
               'fechaFin', to_char(mc.fecha_fin, 'YYYY-MM-DD')
             ) ORDER BY mc.fecha_fin DESC, mc.id DESC)
               FROM webcobro.membresias_compras mc WHERE mc.cliente_id = webcobro.clientes.id), '[]'::jsonb) AS "membresiasCompradas",
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

  const plan = typeof membresia === 'string' && membresia.trim() ? membresia.trim() : 'Sin membresía';
  if (!['Sin membresía', 'Básica', 'Premium'].includes(plan)) {
    return res.status(400).json({ error: 'Las membresías del catálogo se asignan mediante una compra en Recepción.' });
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

  // Las clases que ya pasaron sin que el cliente llegara quedan como inasistencia.
  await marcarInasistencias();

  const conexion = await pool.connect();
  try {
    await conexion.query('BEGIN');
    const existente = (await conexion.query(
      `SELECT ${COLUMNAS_RESERVA} FROM webcobro.reservas WHERE id = $1 FOR UPDATE`,
      [id],
    )).rows[0];

    if (!existente) {
      await conexion.query('ROLLBACK');
      return res.status(404).json({ error: 'La reservación no existe.' });
    }
    if (status === 'asistido' && !flujoReservas.puedeConfirmarAsistencia(existente)) {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: 'Primero registra el pago o la cobertura de esta reserva; debe estar vigente y con cupo confirmado.' });
    }
    if (status === 'asistido' && existente.fecha !== marcaLocal(new Date()).slice(0, 10)) {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: 'La asistencia solo se confirma el dia de la sesion.' });
    }
    if (existente.status === status) {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: status === 'asistido'
        ? 'Este cliente ya tiene asistencia confirmada.'
        : 'La reservación ya estaba cancelada.' });
    }
    if (status === 'asistido' && existente.status === 'cancelado') {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: 'No se puede confirmar asistencia de una reservación cancelada.' });
    }
    if (status === 'asistido' && existente.status === 'no_asistio') {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: 'La clase ya pasó y quedó registrada como inasistencia.' });
    }
    if (status === 'asistido' && existente.capacityStatus === 'espera') {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: 'No se puede confirmar asistencia mientras el cliente siga en lista de espera.' });
    }

    // Cancelación: solo dentro de las 24 horas siguientes a la reservación,
    // antes de que inicie la clase, y sin reembolso (el pago, si lo hubo, se
    // conserva en webcobro.pagos).
    if (status === 'cancelado') {
      const { motivoNoCancelar } = reglasDeReserva(existente);
      if (motivoNoCancelar) {
        await conexion.query('ROLLBACK');
        return res.status(409).json({ error: motivoNoCancelar });
      }
    }

    if (existente.horarioId) {
      await conexion.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`webcobro-horario-${existente.horarioId}`]);
    }
    const actualizada = (await conexion.query(
      `UPDATE webcobro.reservas
          SET estado = $2::text,
              cancelada_en = CASE WHEN $2::text = 'cancelado' THEN NOW() ELSE cancelada_en END
        WHERE id = $1
        RETURNING ${COLUMNAS_RESERVA}`,
      [id, status],
    )).rows[0];

    let promovida = null;
    if (status === 'cancelado' && existente.capacityStatus === 'confirmada' && existente.horarioId) {
      promovida = await promoverListaEspera(conexion, existente.horarioId);
    }

    await conexion.query('COMMIT');
    const sinReembolso = existente.status === 'pagado' ? ' El pago no se reembolsa.' : '';
    res.json({
      mensaje: status === 'asistido'
        ? 'Asistencia confirmada'
        : promovida
          ? `Reservación cancelada.${sinReembolso} ${promovida.client} fue promovido desde la lista de espera.`
          : `Reservación cancelada.${sinReembolso}`,
      reservacion: decorarReserva(actualizada),
      promovida: decorarReserva(promovida),
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
 * POST para reagendar una reservación: solo UNA vez y sin costo.
 * Body: { horarioId, fecha } del nuevo horario (de administrativa).
 *
 * Reglas:
 *  - Solo reservaciones pendientes o pagadas; las inasistencias, canceladas y
 *    asistidas no se reagendan.
 *  - La clase original no debe haber comenzado.
 *  - El nuevo horario debe ser de la MISMA clase (por eso no cambia el precio),
 *    estar activo, no haber pasado y tener cupo (no se reagenda a lista de espera).
 *  - El precio y el pago, si ya lo hubo, se conservan: reagendar no cuesta.
 *  - El lugar que se libera se ofrece a la primera persona en lista de espera.
 */
app.post('/api/reservas/:id/reagendar', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'El id de la reservación no es válido.' });
  }
  const { horarioId, fecha } = req.body ?? {};
  if (typeof horarioId !== 'string' || !horarioId.trim()) {
    return res.status(400).json({ error: 'Elige el nuevo horario.' });
  }
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'La fecha del nuevo horario es obligatoria (YYYY-MM-DD).' });
  }

  await marcarInasistencias();

  const actual = (
    await pool.query(`SELECT ${COLUMNAS_RESERVA} FROM webcobro.reservas WHERE id = $1`, [id])
  ).rows[0];
  if (!actual) {
    return res.status(404).json({ error: 'La reservación no existe.' });
  }
  const reglasPrevias = reglasDeReserva(actual);
  if (reglasPrevias.motivoNoReagendar) {
    return res.status(409).json({ error: reglasPrevias.motivoNoReagendar });
  }
  if (actual.horarioId === horarioId.trim()) {
    return res.status(409).json({ error: 'Elige un horario distinto al que ya tiene reservado.' });
  }

  let destino;
  try {
    destino = await buscarHorarioActivo(fecha, { horarioId: horarioId.trim() });
  } catch (err) {
    console.error('No se pudieron validar los horarios de administrativa:', err);
    return res.status(500).json({ error: 'No se pudieron validar los horarios disponibles.' });
  }
  const nuevoHorario = destino.horario;
  if (!nuevoHorario) {
    return res.status(409).json({ error: `El horario elegido no existe o no está activo el ${fecha}.` });
  }
  if (nuevoHorario.nombreClase !== actual.class) {
    return res.status(409).json({
      error: `Solo se puede reagendar a otro horario de la misma clase ("${actual.class}").`,
    });
  }
  const inicioNuevo = inicioDeClase(nuevoHorario.fecha || fecha, nuevoHorario.horaInicio);
  if (!inicioNuevo || inicioNuevo.getTime() <= Date.now()) {
    return res.status(409).json({ error: `La clase de las ${nuevoHorario.horaInicio} del ${fecha} ya pasó, elige otro horario.` });
  }

  const capacidadTotal = Number(nuevoHorario.capacidadTotal || 0);
  const conexion = await pool.connect();
  try {
    await conexion.query('BEGIN');
    // Se bloquean ambos horarios en orden fijo para evitar interbloqueos.
    const candados = [actual.horarioId, nuevoHorario.idHorario].filter(Boolean).sort();
    for (const candado of candados) {
      await conexion.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`webcobro-horario-${candado}`]);
    }

    // Se vuelve a leer bloqueada por si cambió mientras se consultaba administrativa.
    const bloqueada = (await conexion.query(
      `SELECT ${COLUMNAS_RESERVA} FROM webcobro.reservas WHERE id = $1 FOR UPDATE`,
      [id],
    )).rows[0];
    const reglas = reglasDeReserva(bloqueada);
    if (reglas.motivoNoReagendar) {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: reglas.motivoNoReagendar });
    }

    await membresiasService.validarReagenda(conexion, bloqueada, nuevoHorario.fecha || fecha, nuevoHorario.idClase);

    const duplicada = Number((await conexion.query(
      `SELECT COUNT(*) AS n FROM webcobro.reservas
        WHERE ((cliente_id = $4) OR ($4::integer IS NULL AND tipo = 'visitante' AND cliente = $1)) AND id <> $2 AND horario_id = $3
          AND estado NOT IN ('cancelado', 'no_asistio')`,
      [bloqueada.client, id, nuevoHorario.idHorario, bloqueada.clienteId],
    )).rows[0].n);
    if (duplicada > 0) {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: `"${bloqueada.client}" ya tiene una reservación en ese horario.` });
    }

    const confirmadas = Number((await conexion.query(
      `SELECT COUNT(*) AS n FROM webcobro.reservas
        WHERE horario_id = $1 AND estado_cupo = 'confirmada'
          AND estado NOT IN ('cancelado', 'no_asistio')`,
      [nuevoHorario.idHorario],
    )).rows[0].n);
    if (capacidadTotal > 0 && confirmadas >= capacidadTotal) {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: `El horario de las ${nuevoHorario.horaInicio} del ${fecha} ya no tiene cupo.` });
    }

    // En un UPDATE los valores de la derecha son los anteriores, así que
    // fecha_original/hora_original guardan el horario que se deja.
    const reagendada = (await conexion.query(
      `UPDATE webcobro.reservas
          SET fecha_original = fecha,
              hora_original  = hora,
              fecha          = $2,
              hora           = $3,
              horario_id     = $4,
              hora_fin       = $5,
              estado_cupo    = 'confirmada',
              reagendada     = TRUE,
              reagendada_en  = NOW()
        WHERE id = $1
        RETURNING ${COLUMNAS_RESERVA}`,
      [id, nuevoHorario.fecha || fecha, nuevoHorario.horaInicio, nuevoHorario.idHorario, nuevoHorario.horaFin],
    )).rows[0];

    let promovida = null;
    if (bloqueada.capacityStatus === 'confirmada' && bloqueada.horarioId) {
      promovida = await promoverListaEspera(conexion, bloqueada.horarioId);
    }

    await conexion.query('COMMIT');
    res.json({
      mensaje: `Reservación reagendada sin costo al ${reagendada.fecha} a las ${reagendada.time}. Ya no se podrá volver a reagendar.`,
      reservacion: decorarReserva(reagendada),
      promovida: decorarReserva(promovida),
    });
  } catch (error) {
    await conexion.query('ROLLBACK');
    console.error('No se pudo reagendar la reservación:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo reagendar la reservación.' });
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
    if (!['Sin membresía', 'Básica', 'Premium'].includes(membresia)) {
      return res.status(400).json({ error: 'Las membresías del catálogo se asignan mediante una compra en Recepción.' });
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
    const historial = await pool.query(
      `SELECT 1 FROM webcobro.clientes c WHERE c.id = $1 AND (
        EXISTS (SELECT 1 FROM webcobro.reservas r WHERE r.cliente_id = c.id
          OR (r.tipo = 'cliente' AND r.cliente_id IS NULL AND r.cliente = c.nombre))
        OR EXISTS (SELECT 1 FROM webcobro.asistencias a WHERE a.codigo = 'CLI-' || c.id::text))`, [id],
    );
    if (historial.rowCount) {
      return res.status(409).json({ error: 'El cliente tiene historial de reservas o asistencia. Desactivalo en vez de eliminarlo.' });
    }
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

  // Si la clase ya pasó sin que el cliente llegara, queda como inasistencia.
  await marcarInasistencias();

  const conexion = await pool.connect();
  try {
    await conexion.query('BEGIN');

    //validacion 4 la reservación debe existir (bloqueada para el cobro)
    const reserva = (
      await conexion.query(
        `SELECT id, cliente, cliente_id, tipo, clase, hora, fecha, estado, estado_pago, estado_cupo, precio
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
    if (reserva.estado_pago === 'pagado') {
      await conexion.query('ROLLBACK');
      return res.status(400).json({ error: 'Esta reservación ya fue cobrada.' });
    }
    if (reserva.estado === 'cancelado') {
      await conexion.query('ROLLBACK');
      return res.status(400).json({ error: 'No se puede cobrar una reservación cancelada.' });
    }
    if (reserva.estado === 'no_asistio') {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: 'El cliente no asistió a esta clase: la reservación ya no se puede cobrar.' });
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
    if (reserva.tipo === 'cliente' && !reserva.cliente_id) {
      await conexion.query('ROLLBACK');
      return res.status(409).json({ error: 'Reserva antigua sin socio identificado: requiere conciliacion por ID antes de cobrar.' });
    }

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
          reserva.cliente_id,
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
            SET estado_pago = 'pagado', estado = CASE WHEN estado = 'pendiente' THEN 'pagado' ELSE estado END
          WHERE id = $1
          RETURNING ${COLUMNAS_RESERVA}`,
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
  await marcarInasistencias();
  const resumen = (
    await pool.query(
      `SELECT COUNT(*) FILTER (
                WHERE estado = 'pendiente' AND estado_cupo = 'confirmada' AND fecha = CURRENT_DATE::text
              )::int AS pendientes,
              COUNT(*) FILTER (
                WHERE estado NOT IN ('cancelado', 'no_asistio') AND estado_cupo = 'confirmada' AND fecha = CURRENT_DATE::text
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

// Asistencia adaptada del commit 948c1a5, aislada del cobro y las reservas.
const { montarAsistencia } = require('./asistenciaService');
const asistencia = montarAsistencia(app, pool, {
  turnosHabilitados: process.env.ASISTENCIA_TURNOS_HABILITADOS === 'true',
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
const aplicarEsquema = () =>
  consultaOriginal(fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8'));

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
