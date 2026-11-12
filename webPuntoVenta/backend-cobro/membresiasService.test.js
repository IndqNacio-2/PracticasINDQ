const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { registrarRutas, saldo, buscarCobertura, validarReagenda, finVigencia, condicionesDe } = require('./membresiasService');
const { crearContenidoTicket } = require('./ticketService');

const clase = 'a'.repeat(24);
const catalogoId = 'b'.repeat(24);
const catalogo = { nombre: 'Plan creado por administración', estatus: 'activo', clasesIds: [clase],
  opciones: [{ id: 'mensual', costo: 600, entradas: 4, duracion: 1, unidadDuracion: 'meses', distribucion: 'compartida' }] };
const condiciones = condicionesDe(catalogo, 'mensual');

test('vigencias inclusivas en días y meses, incluyendo fin de mes y año bisiesto', () => {
  assert.equal(finVigencia('2028-02-01', { duracion: 1, unidadDuracion: 'meses' }), '2028-02-29');
  assert.equal(finVigencia('2027-01-31', { duracion: 1, unidadDuracion: 'meses' }), '2027-02-27');
  assert.equal(finVigencia('2027-01-01', { vigenciaDias: 1 }), '2027-01-01');
  assert.throws(() => finVigencia('2027-02-30', { vigenciaDias: 30 }));
  assert.throws(() => finVigencia('2027-01-01', { vigenciaDias: -1 }));
});
test('no vende membresías inactivas, sin clases, sin precio o con opción inventada', () => {
  for (const m of [{ ...catalogo, estatus: 'inactivo' }, { ...catalogo, clasesIds: [] },
    { ...catalogo, opciones: [{ ...catalogo.opciones[0], costo: null }] }]) assert.throws(() => condicionesDe(m, 'mensual'));
  assert.throws(() => condicionesDe(catalogo, 'inventada'));
  assert.deepEqual(condiciones.clasesIds, [clase]);
});
test('saldo aparta pendientes/espera, consume asistidas/faltas y excluye cancelaciones', async () => {
  const usos = [{ estado: 'pagado' }, { estado: 'asistido' }, { estado: 'no_asistio' }];
  const db = { query: async sql => { assert.match(sql, /estado <> 'cancelado'/); return { rows: usos }; } };
  assert.deepEqual(await saldo(db, { id: 1, condiciones }, clase), { total: 4, consumidas: 2, apartadas: 1, disponibles: 1 });
  usos.pop();
  assert.equal((await saldo(db, { id: 1, condiciones }, clase)).disponibles, 2);
});
test('distribución por clase e ilimitada no mezclan saldos', async () => {
  const db = { query: async () => ({ rows: [{ clase_id: clase, estado: 'pagado' }, { clase_id: 'otra', estado: 'asistido' }] }) };
  const porClase = { ...condiciones, opcion: { entradas: 6, distribucion: 'por_clase', entradasPorClase: { [clase]: 3 } } };
  assert.equal((await saldo(db, { id: 1, condiciones: porClase }, clase)).disponibles, 2);
  assert.equal((await saldo(db, { id: 1, condiciones: { ...condiciones, opcion: { entradas: null } } }, clase)).disponibles, null);
});
test('cobertura bloquea compras y no usa saldo agotado ni clases ajenas', async () => {
  const consultas = [];
  const db = { query: async (sql, args) => {
    consultas.push(sql);
    if (/FROM webcobro.membresias_compras/.test(sql)) {
      assert.deepEqual(args, [27, '2099-01-01']);
      return { rows: [{ id: 1, condiciones }, { id: 2, condiciones }] };
    }
    return { rows: args[0] === 1 ? Array.from({ length: 4 }, () => ({ estado: 'pagado' })) : [] };
  } };
  assert.equal((await buscarCobertura(db, 27, clase, '2099-01-01')).id, 2);
  assert.equal(await buscarCobertura(db, 27, 'clase-ajena', '2099-01-01'), null);
  assert.match(consultas[0], /fecha_inicio <= \$2::date AND fecha_fin >= \$2::date/);
  assert.match(consultas[0], /ORDER BY fecha_fin, id FOR UPDATE/);
});
test('reagenda conserva compra y rechaza fechas fuera de cobertura', async () => {
  const db = { query: async () => ({ rows: [{ condiciones, inicio: '2099-01-01', fin: '2099-01-31' }] }) };
  await validarReagenda(db, { membresiaCompraId: 1 }, '2099-01-20', clase);
  await assert.rejects(validarReagenda(db, { membresiaCompraId: 1 }, '2099-02-01', clase), /vigencia/);
  await assert.rejects(validarReagenda(db, { membresiaCompraId: 1 }, '2099-01-20', 'otra'), /clases/);
});

test('API de venta: autorización, pago atómico, precio del catálogo y reintento sin duplicados', async () => {
  const consultas = [];
  let compra;
  let pago;
  const query = async (sql, args) => {
    consultas.push(sql);
    if (/WHERE solicitud_id/.test(sql)) return { rows: compra ? [compra] : [] };
    if (/FROM webcobro.clientes/.test(sql)) return { rows: [{ id: 27, nombre: 'Cliente estable', activo: true }] };
    if (/INSERT INTO webcobro.pagos/.test(sql)) {
      assert.equal(args[2], 600);
      pago = { id: 5, folio: args[7], monto: args[2], metodo_pago: 'efectivo', efectivo_recibido: 700, cambio: 100, creado_en: '2099-01-01T12:00:00Z', usuario: 'Recepción' };
      return { rows: [pago] };
    }
    if (/INSERT INTO webcobro.membresias_compras/.test(sql)) {
      compra = { id: 8, cliente_id: 27, catalogo_id: catalogoId, opcion_id: 'mensual', condiciones: JSON.parse(args[4]), inicio: args[5], fin: args[6], pago_id: 5 };
      return { rows: [compra] };
    }
    if (/SELECT \* FROM webcobro.pagos/.test(sql)) return { rows: [pago] };
    return { rows: [], rowCount: 0 };
  };
  const app = express(); app.use(express.json());
  registrarRutas(app, { connect: async () => ({ query, release() {} }), query }, 'http://127.0.0.1:1/admin/api');
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise(resolve => servidor.once('listening', resolve));
  const original = global.fetch;
  global.fetch = async (url, options) => String(url).includes('/admin/api')
    ? { ok: true, json: async () => String(url).endsWith('/me') ? { user: { nombre: 'Recepción', rol: 'recepcion', estatus: 'activo' } } : catalogo }
    : original(url, options);
  try {
    const api = `http://127.0.0.1:${servidor.address().port}`;
    const body = { clienteId: 27, membresiaId: catalogoId, opcionId: 'mensual', fechaInicio: '2099-01-01',
      solicitudId: '12345678-1234-1234-1234-123456789abc', metodoPago: 'efectivo', efectivoRecibido: 700, precio: 1 };
    assert.equal((await original(`${api}/api/membresias/compras`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, 401);
    for (const status of [201, 200]) {
      const respuesta = await original(`${api}/api/membresias/compras`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer prueba' }, body: JSON.stringify(body) });
      const datos = await respuesta.json();
      assert.equal(respuesta.status, status, JSON.stringify(datos));
      assert.equal(datos.ticket.total, 600);
      assert.equal(datos.ticket.fechaFin, '2099-01-31');
      assert.match(crearContenidoTicket(datos.ticket).toString('ascii'), /VENTA DE MEMBRESIA/);
    }
    assert.equal(consultas.filter(sql => /INSERT INTO webcobro.pagos/.test(sql)).length, 1);
    assert.equal(consultas.filter(sql => /INSERT INTO webcobro.membresias_compras/.test(sql)).length, 1);
    assert.ok(consultas.indexOf('BEGIN') < consultas.findIndex(sql => /INSERT INTO webcobro.pagos/.test(sql)));
    assert.ok(consultas.indexOf('COMMIT') > consultas.findIndex(sql => /INSERT INTO webcobro.membresias_compras/.test(sql)));
  } finally { global.fetch = original; await new Promise(resolve => servidor.close(resolve)); }
});