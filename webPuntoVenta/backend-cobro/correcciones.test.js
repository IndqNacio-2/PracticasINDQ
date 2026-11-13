const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { once } = require('node:events');
const { esCorreoValido } = require('./validacionCliente');
const flujo = require('./reservasFlujo');

// Ejecuta las rutas reales sin importar el servidor ni conectar con PostgreSQL.
async function montar(t) {
  let reserva = { id: 1, client: 'Ana Prueba', clienteId: 1, type: 'cliente', class: 'Yoga',
    fecha: '2099-01-01', time: '10:00', horarioId: 'anterior', status: 'pagado',
    paymentStatus: 'pagado', capacityStatus: 'confirmada', price: 100, reagendada: false, creadoEn: new Date().toISOString() };
  let horario = { idHorario: 'nuevo', idClase: 'clase', nombreClase: 'Yoga', fecha: '2099-01-02',
    horaInicio: '10:00', horaFin: '11:00', capacidadTotal: 10, estatus: 'activo', visibleReservas: true };
  let clase = { idClase: 'clase', estatus: 'activo', precio: 100 };
  let referencias = true, ocupados = 0, existeCliente = true;
  const consultas = [];
  async function query(sql, valores = []) {
    consultas.push({ sql, valores });
    if (sql === 'SELECT 1') return new Promise(() => {}); // impide arranque y aplicación de schema.sql
    if (sql.includes('COUNT(*)')) return { rows: [{ n: sql.includes("estado_cupo = 'confirmada'") ? ocupados : 0 }], rowCount: 1 };
    if (sql.includes('UPDATE webcobro.reservas SET estado')) return { rows: [], rowCount: 0 };
    if (sql.includes('INSERT INTO webcobro.reservas')) {
      reserva = { ...reserva, client: valores[0], type: valores[1], class: valores[2], time: valores[3], price: valores[4], fecha: valores[5], horarioId: valores[6], capacityStatus: valores[7], codigo: valores[8] };
      return { rows: [reserva], rowCount: 1 };
    }
    if (sql.includes('FROM webcobro.reservas WHERE id')) return { rows: reserva ? [reserva] : [], rowCount: reserva ? 1 : 0 };
    if (sql.includes('UPDATE webcobro.reservas') && sql.includes('reagendada     = TRUE')) {
      reserva = { ...reserva, fecha: valores[1], time: valores[2], horarioId: valores[3], reagendada: true };
      return { rows: [reserva], rowCount: 1 };
    }
    if (sql.includes('UPDATE webcobro.reservas') && sql.includes('SET estado = $2')) {
      reserva = { ...reserva, status: valores[1] }; return { rows: [reserva], rowCount: 1 };
    }
    if (sql.includes('UPDATE webcobro.clientes') || sql.includes('INSERT INTO webcobro.clientes')) return { rows: [{ id: 1, nombre: 'Ana Prueba', activo: !sql.includes('FALSE') }], rowCount: 1 };
    if (sql.includes('FROM webcobro.clientes')) {
      if (sql.includes('LOWER(correo)')) return { rows: [], rowCount: 0 };
      return { rows: existeCliente ? [{ id: 1, nombre: 'Ana Prueba', activo: true, membresia: 'Premium' }] : [], rowCount: existeCliente ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  }
  class Pool { on() {} query(...args) { return query(...args); } async connect() { return { query, release() {} }; } }
  const archivo = path.join(__dirname, 'serverWebCobro.js');
  const contexto = {
    require(nombre) {
      if (nombre === 'dotenv/config') return {};
      if (nombre === 'pg') return { Pool };
      if (nombre === './membresiasService') return { registrarRutas() {}, validarReagenda: async () => {}, buscarCobertura: async () => null };
      if (nombre === './asistenciaService') return { montarAsistencia: () => ({}) };
      return require(nombre);
    },
    __dirname, module: { exports: {} }, process: { env: { GATEWAY_MODE: '1' } },
    console: { log() {}, error() {} }, setInterval, setTimeout, AbortSignal,
    fetch: async url => {
      if (url.includes('/validacion')) return Response.json({}, { status: referencias ? 200 : 409 });
      if (url.includes('/clases')) return Response.json(clase ? [clase] : []);
      return Response.json(horario ? [horario] : []);
    },
  };
  vm.runInNewContext(fs.readFileSync(archivo, 'utf8') + '\nmodule.exports.reglasDeReserva = reglasDeReserva;', contexto, { filename: archivo });
  const app = contexto.module.exports;
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  return {
    consultas, reglas: app.reglasDeReserva,
    estado: cambios => { reserva = { ...reserva, ...cambios }; },
    horario: cambios => { horario = cambios === null ? null : { ...horario, ...cambios }; },
    clase: valor => { clase = valor; }, referencias: valor => { referencias = valor; },
    cupo: valor => { ocupados = valor; }, cliente: valor => { existeCliente = valor; },
    enviar: (ruta, method, body) => fetch(base + ruta, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }),
  };
}

test('correo opcional: formatos válidos e inválidos', () => {
  for (const correo of ['', null, undefined, 'ana@example.test', ' Ana+ventas@example.com ']) assert.equal(esCorreoValido(correo), true);
  for (const correo of ['no-es-correo', 'a@b', 'a b@example.test', {}, 42, 'a@@b.com']) assert.equal(esCorreoValido(correo), false);
});

test('clientes: POST/PATCH rechazan correo inválido y DELETE desactiva sin borrar', async t => {
  const api = await montar(t);
  for (const correo of ['no-es-correo', 'a@b', {}, 42]) {
    assert.equal((await api.enviar('/clientes', 'POST', { nombre: 'Ana Prueba', correo })).status, 400);
    assert.equal((await api.enviar('/clientes/1', 'PATCH', { correo })).status, 400);
  }
  assert.equal((await api.enviar('/clientes', 'POST', { nombre: 'Ana Prueba', correo: 'ana@example.test' })).status, 201);
  assert.equal((await api.enviar('/clientes/1', 'PATCH', { correo: 'otra@example.test' })).status, 200);
  assert.equal((await api.enviar('/clientes/1', 'DELETE')).status, 200);
  assert.ok(api.consultas.some(c => c.sql.includes('SET activo = FALSE')));
  assert.equal(api.consultas.some(c => /DELETE FROM/i.test(c.sql)), false);
});

test('reservas: fecha, hora, referencias y cliente se validan antes de insertar', async t => {
  const api = await montar(t);
  const datos = { client: 'Ana Prueba', clienteId: 1, type: 'cliente', class: 'Yoga', time: '10:00', fecha: '2099-01-02', horarioId: 'nuevo' };
  for (const cambio of [{ time: '25:00' }, { time: '10:99' }, { fecha: '2099-02-30' }, { fecha: '2000-01-01' }]) {
    assert.equal((await api.enviar('/reservas', 'POST', { ...datos, ...cambio })).status, 400);
  }
  api.referencias(false); assert.equal((await api.enviar('/reservas', 'POST', datos)).status, 409);
  api.referencias(true); api.clase(null); assert.equal((await api.enviar('/reservas', 'POST', datos)).status, 409);
  api.clase({ idClase: 'clase', estatus: 'activo', precio: 100 });
  for (const cambio of [{ capacidadTotal: 0 }, { capacidadTotal: 1.5 }, { visibleReservas: false }, { fecha: '2099-01-03' }, { horaFin: '09:00' }]) {
    api.horario(cambio); assert.equal((await api.enviar('/reservas', 'POST', datos)).status, 409);
    api.horario({ capacidadTotal: 10, visibleReservas: true, fecha: datos.fecha, horaFin: '11:00' });
  }
  api.cliente(false); assert.equal((await api.enviar('/reservas', 'POST', datos)).status, 404);
  api.cliente(true); api.cupo(10); assert.equal((await api.enviar('/reservas', 'POST', datos)).status, 409);
  assert.equal(api.consultas.some(c => c.sql.includes('INSERT INTO webcobro.reservas')), false);
});

test('reagenda: una vez, sin costo, no por inasistencia y nunca sin cupo', async t => {
  const api = await montar(t); const destino = { horarioId: 'nuevo', fecha: '2099-01-02' };
  api.cupo(10); assert.equal((await api.enviar('/reservas/1/reagendar', 'POST', destino)).status, 409);
  api.cupo(0);
  const primera = await api.enviar('/reservas/1/reagendar', 'POST', destino);
  assert.equal(primera.status, 200); const resultado = await primera.json();
  assert.equal(resultado.reservacion.price, 100); assert.equal(resultado.reservacion.paymentStatus, 'pagado');
  assert.equal(resultado.reservacion.reagendada, true);
  assert.equal((await api.enviar('/reservas/1/reagendar', 'POST', destino)).status, 409);
  api.estado({ reagendada: false, status: 'no_asistio' });
  assert.equal((await api.enviar('/reservas/1/reagendar', 'POST', destino)).status, 409);
  api.estado({ status: 'pagado', fecha: '2000-01-01' });
  assert.ok(api.reglas({ status: 'pagado', fecha: '2000-01-01', time: '10:00' }).motivoNoReagendar, 'Debe detectar inicio pasado');
  const pasada = await api.enviar('/reservas/1/reagendar', 'POST', destino);
  assert.equal(pasada.status, 409, JSON.stringify(await pasada.json()));
  assert.equal((await api.enviar('/reservas/1', 'PATCH', { horarioId: 'otro' })).status, 400);
});

test('creación válida, lista de espera y cancelación conservan el contrato y el pago', async t => {
  const api = await montar(t);
  const datos = { client: 'Ana Prueba', clienteId: 1, type: 'cliente', class: 'Yoga', time: '10:00', fecha: '2099-01-02', horarioId: 'nuevo' };
  assert.equal((await api.enviar('/reservas', 'POST', datos)).status, 201);
  api.cupo(10); api.horario({ listaEsperaHabilitada: true });
  const espera = await api.enviar('/reservas', 'POST', datos);
  assert.equal(espera.status, 201); assert.equal((await espera.json()).reservacion.capacityStatus, 'espera');
  api.estado({ status: 'pagado', paymentStatus: 'pagado', capacityStatus: 'confirmada', price: 100 });
  const cancelada = await api.enviar('/reservas/1', 'PATCH', { status: 'cancelado' });
  assert.equal(cancelada.status, 200); assert.equal((await cancelada.json()).reservacion.paymentStatus, 'pagado');
});

test('cancelación mantiene ventana de 24 horas y asistencia requiere pago y cupo confirmado', async t => {
  const api = await montar(t); const ahora = new Date('2030-01-01T12:00:00');
  const reserva = { status: 'pagado', fecha: '2030-02-01', time: '10:00', creadoEn: new Date(ahora.getTime() - 3600000).toISOString() };
  assert.equal(api.reglas(reserva, ahora).motivoNoCancelar, null);
  assert.match(api.reglas({ ...reserva, creadoEn: new Date(ahora.getTime() - 25 * 3600000).toISOString() }, ahora).motivoNoCancelar, /plazo/);
  assert.equal(flujo.puedeConfirmarAsistencia({ paymentStatus: 'pagado', status: 'pagado', capacityStatus: 'confirmada' }), true);
  assert.equal(flujo.puedeConfirmarAsistencia({ paymentStatus: 'pendiente', status: 'pendiente', capacityStatus: 'confirmada' }), false);
  assert.equal(flujo.puedeConfirmarAsistencia({ paymentStatus: 'pagado', status: 'pagado', capacityStatus: 'espera' }), false);
});