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
            estado AS status, precio::float8 AS price
       FROM webcobro.reservas
      ORDER BY id`,
  );
  res.json(resultado.rows);
});

//POST para registrar una reservacion nueva (socio registrado o visitante)
app.post('/api/reservas', async (req, res) => {
  const { client, type, class: clase, time, price } = req.body ?? {};

  //validacion 1 el nombre del cliente es obligatorio
  if (typeof client !== 'string' || client.trim().length < 3) {
    return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
  }

  //validacion 2 el tipo debe ser socio registrado o visitante
  if (type !== 'cliente' && type !== 'visitante') {
    return res.status(400).json({ error: 'El tipo debe ser cliente o visitante.' });
  }

  //validacion 3 el nombre de la clase es obligatorio. Ya NO se valida contra
  //webcobro.clases: las clases se registran en el módulo administrativo
  //(MongoDB) y el frontend envía el nombre de la clase elegida allí.
  if (typeof clase !== 'string' || clase.trim().length === 0) {
    return res.status(400).json({ error: 'La clase es obligatoria.' });
  }

  //validacion 4 la hora debe ser un HH:MM válido dentro del rango del gym.
  //La hora viene de la clase registrada en administrativa, así que ya no se
  //exige que caiga en punto o a media hora.
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({ error: 'El horario no es valido.' });
  }
  const [horas, minutos] = time.split(':').map(Number);
  if (horas < 6 || horas >= 22 || minutos < 0 || minutos > 59) {
    return res.status(400).json({ error: 'Las clases son de 6:00 a 22:00.' });
  }

  //validacion 5 el monto base debe ser un numero valido (>= 0).
  const monto = Number(price);
  if (!Number.isFinite(monto) || monto < 0) {
    return res.status(400).json({ error: 'El monto no es valido.' });
  }

  /*
   * validacion 6 horario ya pasado. Las reservaciones son para el dia de hoy
   * (recepcion trabaja con las clases del dia), así que no se puede reservar
   * una clase cuya hora ya transcurrio.
   */
  const ahora = new Date();
  const claseHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), horas, minutos);
  if (claseHoy.getTime() < ahora.getTime()) {
    return res.status(409).json({ error: `La clase de las ${time} ya paso, elige otro horario.` });
  }

  /*
   * validacion 7 membresia del socio. Si es "cliente" se busca en
   * webcobro.clientes para validar que este activo y vigente y definir si es
   * Premium (no paga). El precio se define AQUI en el servidor; NO se confia
   * en el que manda el navegador. El visitante siempre paga la tarifa.
   */
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

  /*
   * validacion 8 duplicado: una misma persona no puede reservar dos veces la
   * misma clase en la misma hora (mientras no este cancelada).
   */
  const duplicada = Number(
    (
      await pool.query(
        `SELECT COUNT(*) AS n FROM webcobro.reservas
          WHERE cliente = $1 AND clase = $2 AND hora = $3 AND estado <> 'cancelado'`,
        [client.trim(), clase.trim(), time],
      )
    ).rows[0].n,
  );
  if (duplicada > 0) {
    return res.status(409).json({ error: `"${client.trim()}" ya reservo "${clase.trim()}" a las ${time}.` });
  }

  /*
   * validacion 9 limite de reservaciones activas por socio (anti-acaparamiento
   * de cupo). Maximo 3 reservaciones activas por persona.
   */
  const LIMITE_RESERVAS = 3;
  const activas = Number(
    (
      await pool.query(
        `SELECT COUNT(*) AS n FROM webcobro.reservas
          WHERE cliente = $1 AND estado <> 'cancelado'`,
        [client.trim()],
      )
    ).rows[0].n,
  );
  if (activas >= LIMITE_RESERVAS) {
    return res.status(409).json({ error: `"${client.trim()}" ya tiene ${LIMITE_RESERVAS} reservaciones activas. Cancela una para crear otra.` });
  }

  /*
   * validacion 10 cupo de la clase. La capacidad vive en administrativa
   * (MongoDB), que este backend no consulta, así que el frontend la envía.
   * Aquí se cuenta cuántas reservaciones activas ya hay y se rechaza si se
   * llenó. (confía en el capacity que manda el cliente; en producción se
   * validaría contra la base central de clases.)
   */
  const capacidad = Number(req.body?.capacity);
  const reservadas = Number(
    (
      await pool.query(
        `SELECT COUNT(*) AS n FROM webcobro.reservas
          WHERE clase = $1 AND estado <> 'cancelado'`,
        [clase.trim()],
      )
    ).rows[0].n,
  );
  if (Number.isFinite(capacidad) && capacidad > 0 && reservadas >= capacidad) {
    return res.status(409).json({ error: `La clase "${clase.trim()}" ya no tiene cupo disponible.` });
  }

  const nueva = (
    await pool.query(
      `INSERT INTO webcobro.reservas (cliente, tipo, clase, hora, estado, precio)
       VALUES ($1, $2, $3, $4, 'pendiente', $5)
       RETURNING id, cliente, tipo, clase, hora, estado, precio`,
      [client.trim(), type, clase.trim(), time, precioFinal],
    )
  ).rows[0];

  res.status(201).json({
    mensaje: 'Reservación registrada',
    reservacion: {
      id: nueva.id,
      client: nueva.cliente,
      type: nueva.tipo,
      class: nueva.clase,
      time: nueva.hora,
      status: nueva.estado,
      price: Number(nueva.precio),
    },
  });
});

//GET para clientes para llenar tabla del dashboard
app.get('/api/clientes', async (req, res) => {
  const resultado = await pool.query(
    `SELECT id, nombre, membresia, telefono, activo,
            to_char(vigencia_hasta, 'YYYY-MM-DD') AS vigencia_hasta
       FROM webcobro.clientes ORDER BY id`,
  );
  res.json(resultado.rows);
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
        `SELECT id, cliente, tipo, estado, precio
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

    const monto = Number(reserva.precio);

    //validacion 6 en efectivo, el cliente debe alcanzar el monto a cobrar
    if (metodoPago === 'efectivo' && efectivoRecibido < monto) {
      await conexion.query('ROLLBACK');
      return res.status(400).json({ error: 'El efectivo recibido no alcanza para cubrir el monto.' });
    }

    // El cambio solo existe cuando se paga en efectivo de más (igual que el POS).
    const cambio = metodoPago === 'efectivo' ? Math.max(efectivoRecibido - monto, 0) : null;

    // El socio puede tener ficha en webcobro.clientes; el visitante no.
    const socio = (
      await conexion.query('SELECT id FROM webcobro.clientes WHERE nombre = $1', [reserva.cliente])
    ).rows[0];

    const nuevoPago = (
      await conexion.query(
        `INSERT INTO webcobro.pagos
           (reserva_id, cliente_id, cliente_nombre, monto, metodo_pago,
            efectivo_recibido, cambio, referencia)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, monto::float8 AS monto, metodo_pago,
                   efectivo_recibido::float8 AS efectivo_recibido,
                   cambio::float8 AS cambio, referencia, creado_en`,
        [
          reserva.id,
          socio ? socio.id : null,
          reserva.cliente,
          monto,
          metodoPago,
          metodoPago === 'efectivo' ? efectivoRecibido : null,
          cambio,
          referencia,
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
                    hora AS time, estado AS status, precio::float8 AS price`,
        [reserva.id],
      )
    ).rows[0];

    await conexion.query('COMMIT');

    res.status(201).json({
      mensaje: 'Cobro registrado',
      reserva: reservaPagada,
      pago: {
        id: Number(nuevoPago.id),
        reservaId: reserva.id,
        monto: nuevoPago.monto,
        metodoPago: nuevoPago.metodo_pago,
        efectivoRecibido: nuevoPago.efectivo_recibido,
        cambio: nuevoPago.cambio,
        referencia: nuevoPago.referencia,
        fecha: new Date(nuevoPago.creado_en).toDateString(),
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
      `SELECT COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes,
              COUNT(*)::int AS total
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
