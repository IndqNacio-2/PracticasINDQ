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

  //validacion 3 la clase debe existir en el catalogo
  const claseExiste = (
    await pool.query('SELECT 1 FROM webcobro.clases WHERE nombre = $1', [clase])
  ).rows[0];
  if (!claseExiste) {
    return res.status(400).json({ error: 'La clase seleccionada no existe.' });
  }

  //validacion 4 el horario debe estar dentro del horario del gym, en punto o a media hora
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({ error: 'El horario no es valido.' });
  }
  const [horas, minutos] = time.split(':').map(Number);
  if (horas < 6 || horas >= 22 || (minutos !== 0 && minutos !== 30)) {
    return res.status(400).json({ error: 'Las clases son de 6:00 a 22:00, en punto o a media hora.' });
  }

  //validacion 5 el monto debe ser un numero y el visitante siempre paga
  const monto = Number(price);
  if (!Number.isFinite(monto) || monto < 0) {
    return res.status(400).json({ error: 'El monto no es valido.' });
  }
  if (type === 'visitante' && monto <= 0) {
    return res.status(400).json({ error: 'El visitante debe pagar la tarifa de la clase.' });
  }

  //validacion 6 no se puede repetir la clase en el mismo horario
  const repetida = (
    await pool.query(
      `SELECT 1 FROM webcobro.reservas
        WHERE clase = $1 AND hora = $2 AND estado <> 'cancelado'`,
      [clase, time],
    )
  ).rows[0];
  if (repetida) {
    return res.status(409).json({ error: 'Ya existe una reservación en ese horario.' });
  }

  const nueva = (
    await pool.query(
      `INSERT INTO webcobro.reservas (cliente, tipo, clase, hora, estado, precio)
       VALUES ($1, $2, $3, $4, 'pendiente', $5)
       RETURNING id, cliente, tipo, clase, hora, estado, precio`,
      [client.trim(), type, clase, time, monto],
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
    'SELECT id, nombre, membresia, telefono FROM webcobro.clientes ORDER BY id',
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

//Post para la api de cobros
app.post('/api/cobros', async (req, res) => {
  const { clienteId, monto } = req.body;

  //validacion 1 para saber si existe el cliente
  const cliente = (
    await pool.query('SELECT id, nombre FROM webcobro.clientes WHERE id = $1', [clienteId])
  ).rows[0];
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  //validacion 2 no cobrar el doble hoy
  const yaCobrado = (
    await pool.query(
      `SELECT 1 FROM webcobro.pagos
        WHERE cliente_id = $1 AND creado_en::date = CURRENT_DATE`,
      [clienteId],
    )
  ).rows[0];
  if (yaCobrado) return res.status(400).json({ error: `${cliente.nombre} ya fue cobrado hoy` });

  const nuevoPago = (
    await pool.query(
      `INSERT INTO webcobro.pagos (cliente_id, cliente_nombre, monto)
       VALUES ($1, $2, $3)
       RETURNING id, cliente_id, cliente_nombre, monto::float8 AS monto, creado_en`,
      [clienteId, cliente.nombre, monto],
    )
  ).rows[0];

  res.status(201).json({
    mensaje: 'Pago registrado',
    pago: {
      id: Number(nuevoPago.id),
      clienteId: nuevoPago.cliente_id,
      clienteNombre: nuevoPago.cliente_nombre,
      monto: nuevoPago.monto,
      fecha: new Date(nuevoPago.creado_en).toDateString(),
    },
  });
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
app.post('/api/asistencia/marcar', async (req, res) => {
  const codigo = (req.body.codigo || '').trim().toUpperCase();

  //validacion 1 formato EMP-XXX
  if (!/^EMP-\d{3}$/.test(codigo)) {
    return res.status(400).json({ error: 'Formato inválido. Ejemplo: EMP-101' });
  }

  //Validacon 2 : corroboramos existencia del empleado
  const empleado = (
    await pool.query('SELECT codigo, nombre, rol FROM webcobro.empleados WHERE codigo = $1', [codigo])
  ).rows[0];
  if (!empleado) return res.status(404).json({ error: `Código ${codigo} no registrado` });

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

  //logica pora entrada y salida
  const tipo = (!ultimo || ultimo.tipo === 'salida') ? 'entrada' : 'salida';

  const registro = (
    await pool.query(
      `INSERT INTO webcobro.asistencias (codigo, nombre, tipo)
       VALUES ($1, $2, $3)
       RETURNING id, codigo, nombre, tipo, creado_en`,
      [codigo, empleado.nombre, tipo],
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
