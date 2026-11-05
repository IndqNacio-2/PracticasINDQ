const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');
const { puedeConfirmarAsistencia, marcarInasistencias } = require('./reservasFlujo');

test('pago y asistencia son independientes; no se confirma sin pago o en espera', () => {
  const base = { status: 'pagado', paymentStatus: 'pagado', capacityStatus: 'confirmada' };
  assert.equal(puedeConfirmarAsistencia(base), true);
  for (const cambios of [{ paymentStatus: 'pendiente' }, { capacityStatus: 'espera' },
    { status: 'asistido' }, { status: 'cancelado' }, { status: 'no_asistio' }]) {
    assert.equal(puedeConfirmarAsistencia({ ...base, ...cambios }), false);
  }
});

test('inasistencias: incluye pagadas, respeta fin de clase y conserva pago', async () => {
  let consulta;
  assert.equal(await marcarInasistencias({ query: async (sql, args) => {
    consulta = { sql, args }; return { rowCount: 2 };
  } }, new Date(2026, 10, 5, 19, 0)), 2);
  assert.match(consulta.sql, /estado IN \('pendiente', 'pagado'\)/);
  assert.match(consulta.sql, /hora_fin\) <= \$1/);
  assert.doesNotMatch(consulta.sql, /SET estado_pago/);
  assert.deepEqual(consulta.args, ['2026-11-05 19:00', '2026-11-05 18:45']);
});

// Se cargan las rutas reales con pg simulado. Se excluye el arranque que
// aplica esquema y programa tareas: estas pruebas nunca conectan a una BD.
async function conApi(query, ejecutar, fetchAdmin = fetch) {
  const archivo = path.join(__dirname, 'serverWebCobro.js');
  const fuente = fs.readFileSync(archivo, 'utf8').split('// Asistencia adaptada del commit')[0]
    + '\nmodule.exports = app;';
  const requerir = createRequire(archivo);
  class Pool {
    on() {}
    query(...args) { return query(...args); }
    async connect() { return { query, release() {} }; }
  }
  const contexto = { module: { exports: {} }, require: nombre => nombre === 'pg' ? { Pool }
    : nombre === './ticketService' ? { imprimirTicket: async () => true }
      : nombre === 'dotenv/config' ? {} : requerir(nombre),
  console: { log() {}, error() {} }, process: { env: {} }, __dirname, fetch: fetchAdmin, AbortSignal, setTimeout, clearTimeout };
  vm.runInNewContext(fuente, contexto, { filename: archivo });
  const servidor = contexto.module.exports.listen(0, '127.0.0.1');
  await new Promise(resolve => servidor.once('listening', resolve));
  try { await ejecutar(`http://127.0.0.1:${servidor.address().port}`); }
  finally { await new Promise(resolve => servidor.close(resolve)); }
}

test('GET clientes incluye compras reales por ID sin reemplazar compatibilidad histórica', async () => {
  const compras = [{ id: 9, nombre: 'Yoga vendido', fechaInicio: '2026-11-01', fechaFin: '2026-11-30' }];
  await conApi(async sql => {
    assert.match(sql, /jsonb_agg\(jsonb_build_object/);
    assert.match(sql, /mc\.condiciones->>'nombre'/);
    assert.match(sql, /mc\.cliente_id = webcobro\.clientes\.id/);
    assert.match(sql, /'\[\]'::jsonb/);
    return { rows: [{ id: 1, membresia: 'Premium', membresiasCompradas: compras },
      { id: 2, membresia: 'Básica', membresiasCompradas: [] }] };
  }, async api => {
    const respuesta = await fetch(`${api}/api/clientes`);
    assert.equal(respuesta.status, 200);
    const clientes = await respuesta.json();
    assert.deepEqual(clientes[0].membresiasCompradas, compras);
    assert.deepEqual(clientes[1].membresiasCompradas, []);
  });
});

test('PATCH real rechaza asistencia sin pago y acepta pagada sin perder pago', async () => {
  for (const pagada of [false, true]) {
    let actualizada = false;
    const ahora = new Date();
    const fecha = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}-${String(ahora.getDate()).padStart(2,'0')}`;
    const reserva = { id: 1, status: pagada ? 'pagado' : 'pendiente', paymentStatus: pagada ? 'pagado' : 'pendiente',
      capacityStatus: 'confirmada', fecha, time: '23:59', creadoEn: ahora.toISOString() };
    await conApi(async sql => {
      if (/SELECT.*FROM webcobro.reservas WHERE id/s.test(sql)) return { rows: [reserva] };
      if (/SET estado = \$2/.test(sql)) {
        actualizada = true; assert.doesNotMatch(sql, /estado_pago\s*=/);
        return { rows: [{ ...reserva, status: 'asistido' }] };
      }
      return { rows: [], rowCount: 0 };
    }, async api => {
      const respuesta = await fetch(`${api}/api/reservas/1`, { method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'asistido' }) });
      assert.equal(respuesta.status, pagada ? 200 : 409);
      assert.equal(actualizada, pagada);
    });
  }
});

test('baja real bloquea historial; no ejecuta DELETE', async () => {
  await conApi(async sql => {
    assert.doesNotMatch(sql, /DELETE FROM/);
    return { rows: [{ id: 1 }], rowCount: 1 };
  }, async api => {
    assert.equal((await fetch(`${api}/api/clientes/1`, { method: 'DELETE' })).status, 409);
  });
});

test('schema conserva historial y recupera IDs de pagos, no por coincidencia de nombre', () => {
  const sql = fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8').split('-- Flujo de reservas:')[1];
  assert.match(sql, /REFERENCES webcobro.clientes\(id\) ON DELETE RESTRICT/);
  assert.match(sql, /WHERE estado_pago IS NULL/);
  assert.match(sql, /p.reserva_id = r.id/);
  assert.doesNotMatch(sql, /nombre\s*=/);
});

test('POST real usa ID, serializa por socio y cuenta solo reservas futuras pendientes o pagadas', async () => {
  const consultas = [];
  const socio = { nombre: 'Nombre repetido', activo: true, membresia: 'Básica', vigencia: '2099-12-31' };
  await conApi(async (sql, args) => {
    consultas.push({ sql, args });
    if (/FROM webcobro.clientes/.test(sql)) {
      assert.match(sql, /WHERE id = \$1/); assert.equal(args[0], 27);
      return { rows: [socio] };
    }
    if (/COUNT\(\*\)/.test(sql)) return { rows: [{ n: 0 }] };
    if (/INSERT INTO webcobro.reservas/.test(sql)) {
      assert.equal(args[0], socio.nombre); assert.equal(args[10], 27); assert.equal(args[11], '19:00');
      return { rows: [{ id: 1, status: 'pendiente', paymentStatus: 'pendiente', fecha: '2099-01-01', time: '18:00' }] };
    }
    return { rows: [], rowCount: 0 };
  }, async api => {
    const respuesta = await fetch(`${api}/api/reservas`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: 'Nombre enviado', clienteId: 27, type: 'cliente', class: 'Yoga',
        time: '18:00', fecha: '2099-01-01', horarioId: 'sesion-1' }) });
    assert.equal(respuesta.status, 201, JSON.stringify(await respuesta.json()));
  }, async url => ({ ok: true, json: async () => String(url).includes('/horarios')
    ? [{ idHorario: 'sesion-1', idClase: 'clase-1', nombreClase: 'Yoga', horaInicio: '18:00', horaFin: '19:00', capacidadTotal: 12 }]
    : [{ idClase: 'clase-1', precio: 100 }] }));
  const candados = consultas.filter(c => /pg_advisory_xact_lock/.test(c.sql));
  assert.equal(candados[0].args[0], 'webcobro-cliente-27');
  const limite = consultas.find(c => /COUNT/.test(c.sql) && /\|\|/.test(c.sql));
  assert.match(limite.sql, /estado IN \('pendiente', 'pagado'\)/);
  assert.match(limite.sql, /hora\) > \$3/);
  assert.equal(limite.args[1], 27);
});

test('POST real cubre con compra del catálogo y aparta la entrada dentro de la transacción', async () => {
  const consultas = [];
  const condiciones = { clasesIds: ['clase-1'], opcion: { entradas: 4, distribucion: 'compartida' } };
  await conApi(async (sql, args) => {
    consultas.push({ sql, args });
    if (/FROM webcobro.clientes/.test(sql)) return { rows: [{ nombre: 'Socio', activo: true, membresia: 'Premium', vigencia: '2000-01-01' }] };
    if (/SELECT 1 FROM webcobro.membresias_compras/.test(sql)) return { rows: [{ uno: 1 }], rowCount: 1 };
    if (/FROM webcobro.membresias_compras/.test(sql)) return { rows: [{ id: 9, condiciones }] };
    if (/SELECT clase_id/.test(sql)) return { rows: [] };
    if (/COUNT\(\*\)/.test(sql)) return { rows: [{ n: 0 }] };
    if (/INSERT INTO webcobro.reservas/.test(sql)) {
      assert.equal(args[4], 0);
      return { rows: [{ id: 1, fecha: '2099-01-01', time: '18:00', status: 'pendiente' }] };
    }
    if (/SET membresia_compra_id/.test(sql)) {
      assert.deepEqual(Array.from(args), [1, 9, 'clase-1']);
      assert.match(sql, /estado_pago = 'pagado'/);
      return { rows: [{ id: 1, membresiaCompraId: 9, paymentStatus: 'pagado', status: 'pagado', fecha: '2099-01-01', time: '18:00' }] };
    }
    return { rows: [], rowCount: 0 };
  }, async api => {
    const respuesta = await fetch(`${api}/api/reservas`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: 'Socio', clienteId: 27, type: 'cliente', class: 'Yoga', time: '18:00', fecha: '2099-01-01', horarioId: 'sesion-1' }) });
    const datos = await respuesta.json();
    assert.equal(respuesta.status, 201, JSON.stringify(datos));
    assert.equal(datos.reservacion.membresiaCompraId, 9);
    assert.equal(datos.reservacion.paymentStatus, 'pagado');
  }, async url => ({ ok: true, json: async () => String(url).includes('/horarios')
    ? [{ idHorario: 'sesion-1', idClase: 'clase-1', nombreClase: 'Yoga', horaInicio: '18:00', horaFin: '19:00', capacidadTotal: 12 }]
    : [{ idClase: 'clase-1', precio: 100 }] }));
  const bloqueo = consultas.findIndex(c => /ORDER BY fecha_fin, id FOR UPDATE/.test(c.sql));
  assert.ok(bloqueo >= 0);
  assert.ok(consultas.findIndex(c => /SET membresia_compra_id/.test(c.sql)) > bloqueo);
  assert.ok(consultas.findIndex(c => c.sql === 'COMMIT') > bloqueo);
});