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
    assert.doesNotMatch(sql, /to_jsonb\(webcobro\.clientes\)/, 'La fila completa se referencia por su nombre de tabla, no esquema.tabla');
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
    if (sql.includes('UPDATE webcobro.clientes') || sql.includes('INSERT INTO webcobro.clientes')) {
      if (valores.includes('SOC-CARRERA')) throw Object.assign(new Error('duplicado concurrente'), { code: '23505' });
      return { rows: [{ id: 1, nombre: 'Ana Prueba', activo: !sql.includes('FALSE') }], rowCount: 1 };
    }
    if (sql.includes('FROM webcobro.clientes')) {
      if (sql.includes("->>'codigo_usuario'")) return { rows: valores[0] === 'SOC-OCUPADO' ? [{ id: 2 }] : [], rowCount: 0 };
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

test('listado de clientes y disponibilidad usan una referencia de fila válida en PostgreSQL', async t => {
  const api = await montar(t);
  assert.equal((await api.enviar('/clientes', 'GET')).status, 200);
  assert.equal((await api.enviar('/clientes/codigo-disponible?codigo=SOC-LIBRE', 'GET')).status, 200);
  assert.ok(api.consultas.some(c => c.sql.includes("COALESCE(to_jsonb(clientes)->>'codigo_usuario'")));
});

test('clientes: validaciones de nombre, teléfono y correo en POST y PATCH', async t => {
  const api = await montar(t);
  for (const [ruta, metodo] of [['/clientes', 'POST'], ['/clientes/1', 'PATCH']]) {
    for (const cambio of [{ nombre: 'Ana123' }, { nombre: 'Ana!' }, { nombre: 'A B' }, { nombre: 42 }, { telefono: '12345678901' }, { telefono: '123abc' }, { telefono: 123 }, { correo: 'a..b@example.com' }, { correo: 'a@-example.com' }, { correo: 'a@b..com' }, { correo: `${'a'.repeat(65)}@example.com` }]) {
      const antes = api.consultas.filter(c => /INSERT INTO webcobro.clientes|UPDATE webcobro.clientes/.test(c.sql)).length;
      const respuesta = await api.enviar(ruta, metodo, { nombre: 'José Muñoz', correo: 'ana@example.com', ...cambio });
      assert.equal(respuesta.status, 400, JSON.stringify(cambio));
      assert.equal(api.consultas.filter(c => /INSERT INTO webcobro.clientes|UPDATE webcobro.clientes/.test(c.sql)).length, antes);
    }
    const respuesta = await api.enviar(ruta, metodo, { nombre: 'José Muñoz', telefono: '0123456789', correo: 'ana+ventas@example.com' });
    assert.equal(respuesta.status, metodo === 'POST' ? 201 : 200);
  }
  assert.equal((await api.enviar('/clientes/1', 'PATCH', { activo: false })).status, 200);
  assert.equal((await api.enviar('/clientes/1', 'PATCH', { telefono: '' })).status, 200);
  for (const correo of ['', '   ', null]) {
    assert.equal((await api.enviar('/clientes', 'POST', { nombre: 'Ana Salud', correo })).status, 400);
    assert.equal((await api.enviar('/clientes/1', 'PATCH', { correo })).status, 400);
  }
  assert.equal((await api.enviar('/clientes', 'POST', { nombre: 'Ana Salud' })).status, 400);
});

test('código editable: valida disponibilidad, formato y guarda sin cambiar el ID', async t => {
  const api = await montar(t);
  for (const [ruta, metodo] of [['/clientes', 'POST'], ['/clientes/1', 'PATCH']]) {
    assert.equal((await api.enviar(ruta, metodo, { nombre: 'Ana Prueba', correo: 'ana@example.com', codigo: 'SOC-OCUPADO' })).status, 409);
    assert.equal((await api.enviar(ruta, metodo, { nombre: 'Ana Prueba', correo: 'ana@example.com', codigo: 'SOC-CARRERA' })).status, 409);
    for (const codigo of ['12', 'CLI-2', 'EMP-101', 'ab', 'SOC 123', {}, 'A'.repeat(31)]) {
      assert.equal((await api.enviar(ruta, metodo, { nombre: 'Ana Prueba', correo: 'ana@example.com', codigo })).status, 400);
    }
    assert.equal((await api.enviar(ruta, metodo, { nombre: 'Ana Prueba', correo: 'ana@example.com', codigo: ' soc-123 ' })).status, metodo === 'POST' ? 201 : 200);
  }
  const alta = api.consultas.find(c => c.sql.includes('INSERT INTO webcobro.clientes') && c.sql.includes('codigo_usuario') && c.valores.includes('SOC-123'));
  assert.equal(alta.valores[8], 'SOC-123');
  const cambio = api.consultas.find(c => c.sql.startsWith('UPDATE webcobro.clientes SET codigo_usuario') && c.valores.includes('SOC-123'));
  assert.equal(cambio.valores[0], 'SOC-123');
  assert.equal(cambio.valores.at(-1), 1);
  assert.doesNotMatch(cambio.sql.split('WHERE')[0], /SET id|DELETE/);
  assert.equal((await api.enviar('/clientes/1', 'PATCH', { codigo: 'CLI-1' })).status, 200);
  assert.equal((await api.enviar('/clientes/1', 'PATCH', { codigo: '' })).status, 200);
  const disponible = await api.enviar('/clientes/codigo-disponible?codigo=SOC-OCUPADO', 'GET');
  assert.equal(disponible.status, 200);
  assert.equal((await disponible.json()).disponible, false);
});

test('correo obligatorio: formatos válidos e inválidos', () => {
  for (const correo of ['ana@example.test', ' Ana+ventas@example.com ']) assert.equal(esCorreoValido(correo), true);
  for (const correo of ['', '   ', null, undefined, 'no-es-correo', 'a@b', 'a b@example.test', {}, 42, 'a@@b.com']) assert.equal(esCorreoValido(correo), false);
});

test('salud: normaliza etiquetas sin duplicados y valida tipos y longitud', () => {
  const { normalizarSalud } = require('./saludCliente');
  assert.deepEqual(normalizarSalud({ enfermedades: [' Asma ', 'asma'], lesiones: [] }), { enfermedades: ['Asma'], lesiones: [] });
  assert.deepEqual(normalizarSalud({ activo: false }), {});
  for (const valor of [null, 'Asma', {}, [42], [''], ['x'.repeat(61)]]) {
    assert.throws(() => normalizarSalud({ enfermedades: valor }));
    assert.throws(() => normalizarSalud({ lesiones: valor }));
  }
});

test('salud: rutas reales guardan, limpian y conservan campos omitidos', async t => {
  const api = await montar(t);
  assert.equal((await api.enviar('/clientes', 'POST', { nombre: 'Ana Salud', correo: 'ana@example.com', enfermedades: [' Asma ', 'asma'], lesiones: ['Rodilla'] })).status, 201);
  const alta = api.consultas.find(c => c.sql.includes('INSERT INTO webcobro.clientes'));
  assert.deepEqual(JSON.parse(JSON.stringify(alta.valores.slice(-2))), [['Asma'], ['Rodilla']]);
  assert.match(alta.sql, /enfermedades, lesiones/);
  assert.equal((await api.enviar('/clientes/1', 'PATCH', { enfermedades: [] })).status, 200);
  const cambio = api.consultas.find(c => c.sql.includes('UPDATE webcobro.clientes SET enfermedades'));
  assert.match(cambio.sql, /enfermedades = \$1::text\[\]/);
  assert.doesNotMatch(cambio.sql.split('RETURNING')[0], /lesiones =/);
  assert.deepEqual(JSON.parse(JSON.stringify(cambio.valores)), [[], 1]);
  assert.equal((await api.enviar('/clientes/1', 'PATCH', { activo: false })).status, 200);
  const estatus = api.consultas.find(c => c.sql.includes('UPDATE webcobro.clientes SET activo'));
  assert.doesNotMatch(estatus.sql.split('RETURNING')[0], /enfermedades =|lesiones =/);
  for (const method of ['POST', 'PATCH']) {
    assert.equal((await api.enviar(method === 'POST' ? '/clientes' : '/clientes/1', method, { nombre: 'Ana Salud', lesiones: [7] })).status, 400);
  }
  await api.enviar('/clientes', 'GET');
  assert.ok(api.consultas.some(c => /SELECT id, nombre, membresia, telefono, correo, activo, enfermedades, lesiones/.test(c.sql)));
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