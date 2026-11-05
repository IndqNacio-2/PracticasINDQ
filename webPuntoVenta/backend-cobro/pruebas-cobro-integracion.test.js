const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Carga el servidor con PostgreSQL, Express e impresora simulados: no abre puertos
// ni ejecuta SQL real. Comprueba que la adaptación conserva el flujo transaccional.
function preparar(estadoCupo = 'confirmada', impresion = Promise.resolve(false), estado = 'pendiente', consultaPool = async () => ({ rows: [] })) {
  const rutas = new Map();
  const consultas = [];
  const impresiones = [];
  const reserva = { id: 1, cliente: 'Socio', cliente_id: 2, tipo: 'cliente', clase: 'Yoga', hora: '12:00', fecha: '2026-11-04', estado, estado_pago: 'pendiente', estado_cupo: estadoCupo, precio: 180 };
  const conexion = {
    async query(sql, parametros) {
      consultas.push({ sql, parametros });
      if (sql.includes('FOR UPDATE')) return { rows: [reserva] };
      if (sql.includes('to_char(CURRENT_DATE')) return { rows: [{ fecha: '20261103', lock_id: 1 }] };
      if (sql.includes('COALESCE(MAX')) return { rows: [{ numero: 1 }] };
      if (sql.includes('SELECT id FROM webcobro.clientes')) return { rows: [{ id: 2 }] };
      if (sql.includes('INSERT INTO webcobro.pagos')) return { rows: [{ id: 3, folio: 'NCC-20261103-0001', monto: 180, metodo_pago: 'efectivo', efectivo_recibido: 200, cambio: 20, usuario: 'Recepcion', creado_en: '2026-11-03T12:00:00Z' }] };
      if (sql.includes('UPDATE webcobro.reservas')) return { rows: [{ id: 1, status: 'pagado', capacityStatus: estadoCupo }] };
      return { rows: [] };
    },
    release() { consultas.push({ sql: 'RELEASE' }); },
  };
  class PoolSimulado {
    on() {}
    async query(sql, parametros) { return consultaPool(sql, parametros); }
    async connect() { return conexion; }
  }
  const app = { use() {}, listen() { throw new Error('No debe abrir puertos'); } };
  for (const metodo of ['get', 'post', 'patch', 'delete']) app[metodo] = (ruta, handler) => rutas.set(`${metodo} ${ruta}`, handler);
  const express = Object.assign(() => app, { json: () => () => {} });
  const contexto = {
    require(nombre) {
      if (['node:crypto', 'node:fs', 'node:path'].includes(nombre)) return require(nombre);
      if (nombre === 'dotenv/config') return {};
      if (nombre === 'express') return express;
      if (nombre === 'cors') return () => () => {};
      if (nombre === 'pg') return { Pool: PoolSimulado };
      if (nombre === './reservasFlujo') return require('./reservasFlujo');
      if (nombre === './membresiasService') return { registrarRutas() {} };
      if (nombre === './asistenciaService') return { montarAsistencia() { return {}; } };
      if (nombre === './ticketService') return { imprimirTicket(ticket) {
        assert.ok(consultas.some(q => q.sql === 'COMMIT'));
        impresiones.push(ticket);
        return impresion;
      } };
      throw new Error(`Importación inesperada: ${nombre}`);
    },
    module: { exports: {} },
    __dirname,
    setInterval() { return { unref() {} }; },
    process: { env: { GATEWAY_MODE: '1' } },
    console: { log() {}, warn() {}, error() {} },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'serverWebCobro.js'), 'utf8') +
    '\n;globalThis.reglasParaPrueba = reglasDeReserva; globalThis.inasistenciasParaPrueba = marcarInasistencias;', contexto);
  const respuesta = { codigo: 200, cuerpo: null, status(codigo) { this.codigo = codigo; return this; }, json(cuerpo) { this.cuerpo = cuerpo; return this; } };
  return { cobrar: rutas.get('post /api/cobros'), consultas, impresiones, respuesta,
    editarCliente: rutas.get('patch /api/clientes/:id'), eliminarCliente: rutas.get('delete /api/clientes/:id'),
    reglas: contexto.reglasParaPrueba, marcarInasistencias: contexto.inasistenciasParaPrueba };
}

test('editar/baja de cliente actualiza PostgreSQL y devuelve la fila guardada', async () => {
  let update;
  const cliente = { id: 18, nombre: 'pedro lomas', activo: false, correo: null };
  const prueba = preparar('confirmada', Promise.resolve(false), 'pendiente', async (sql, parametros) => {
    if (sql.startsWith('SELECT id FROM webcobro.clientes WHERE id')) return { rows: [{ id: 18 }] };
    if (sql.startsWith('UPDATE webcobro.clientes')) { update = { sql, parametros }; return { rows: [cliente] }; }
    return { rows: [] };
  });
  await prueba.editarCliente({ params: { id: '18' }, body: { nombre: 'pedro lomas', correo: '', activo: false } }, prueba.respuesta);
  assert.equal(prueba.respuesta.codigo, 200);
  assert.equal(prueba.respuesta.cuerpo.cliente, cliente);
  assert.deepEqual(Array.from(update.parametros), ['pedro lomas', null, false, 18]);
  assert.match(update.sql, /UPDATE webcobro.clientes/);
});

test('correo duplicado rechaza edición sin ejecutar UPDATE', async () => {
  let updates = 0;
  const prueba = preparar('confirmada', Promise.resolve(false), 'pendiente', async sql => {
    if (sql.startsWith('UPDATE')) updates++;
    return { rows: [{ id: sql.includes('LOWER(correo)') ? 2 : 18 }] };
  });
  await prueba.editarCliente({ params: { id: '18' }, body: { correo: 'otro@gmail.com' } }, prueba.respuesta);
  assert.equal(prueba.respuesta.codigo, 409);
  assert.match(prueba.respuesta.cuerpo.error, /correo/);
  assert.equal(updates, 0);
});

test('eliminar cliente con historial mantiene protección 409', async () => {
  const prueba = preparar('confirmada', Promise.resolve(false), 'pendiente', async sql => {
    if (sql.startsWith('DELETE FROM webcobro.clientes')) throw Object.assign(new Error('FK'), { code: '23503' });
    return { rows: [] };
  });
  await prueba.eliminarCliente({ params: { id: '18' } }, prueba.respuesta);
  assert.equal(prueba.respuesta.codigo, 409);
  assert.match(prueba.respuesta.cuerpo.error, /reservaciones o pagos/);
});

test('cobro conserva monto del servidor, transacción y respuesta aunque falle impresora', async () => {
  const prueba = preparar('confirmada', Promise.resolve(false));
  await prueba.cobrar({ body: { reservaId: 1, metodoPago: 'efectivo', efectivoRecibido: 200, price: 1 } }, prueba.respuesta);
  assert.equal(prueba.respuesta.codigo, 201);
  assert.equal(prueba.respuesta.cuerpo.ticket.total, 180);
  assert.equal(prueba.respuesta.cuerpo.ticket.cambio, 20);
  assert.equal(prueba.respuesta.cuerpo.reserva.capacityStatus, 'confirmada');
  assert.equal(prueba.impresiones.length, 1);
  assert.ok(prueba.consultas.some(q => q.sql.includes('FOR UPDATE')));
  assert.equal(prueba.consultas.at(-1).sql, 'RELEASE');
});

test('reservación en espera no se cobra ni se imprime', async () => {
  const prueba = preparar('espera');
  await prueba.cobrar({ body: { reservaId: 1, metodoPago: 'efectivo', efectivoRecibido: 200 } }, prueba.respuesta);
  assert.equal(prueba.respuesta.codigo, 409);
  assert.equal(prueba.impresiones.length, 0);
  assert.ok(prueba.consultas.some(q => q.sql === 'ROLLBACK'));
  assert.ok(!prueba.consultas.some(q => q.sql.includes('INSERT INTO')));
});

test('efectivo insuficiente no guarda pago ni imprime', async () => {
  const prueba = preparar();
  await prueba.cobrar({ body: { reservaId: 1, metodoPago: 'efectivo', efectivoRecibido: 100 } }, prueba.respuesta);
  assert.equal(prueba.respuesta.codigo, 400);
  assert.equal(prueba.impresiones.length, 0);
  assert.ok(prueba.consultas.some(q => q.sql === 'ROLLBACK'));
});

test('inasistencia de reserva impide cobro e impresión', async () => {
  const prueba = preparar('confirmada', Promise.resolve(false), 'no_asistio');
  await prueba.cobrar({ body: { reservaId: 1, metodoPago: 'efectivo', efectivoRecibido: 200 } }, prueba.respuesta);
  assert.equal(prueba.respuesta.codigo, 409);
  assert.equal(prueba.impresiones.length, 0);
  assert.ok(prueba.consultas.some(q => q.sql === 'ROLLBACK'));
  assert.ok(!prueba.consultas.some(q => q.sql.includes('INSERT INTO')));
});

test('reglas de Carlos: cancelación de 24 horas, espera y una sola reagenda', () => {
  const { reglas } = preparar();
  const ahora = new Date(2026, 10, 4, 12, 0);
  const reserva = { status: 'pendiente', capacityStatus: 'confirmada', fecha: '2026-11-06',
    time: '12:00', creadoEn: new Date(ahora.getTime() - 25 * 3600000).toISOString() };
  assert.match(reglas(reserva, ahora).motivoNoCancelar, /24 horas/);
  assert.equal(reglas({ ...reserva, capacityStatus: 'espera' }, ahora).motivoNoCancelar, null);
  assert.equal(reglas(reserva, ahora).motivoNoReagendar, null);
  assert.match(reglas({ ...reserva, reagendada: true }, ahora).motivoNoReagendar, /una vez/);
  for (const status of ['asistido', 'cancelado', 'no_asistio']) {
    assert.ok(reglas({ ...reserva, status }, ahora).motivoNoCancelar);
    assert.ok(reglas({ ...reserva, status }, ahora).motivoNoReagendar);
  }
  assert.match(reglas({ ...reserva, fecha: '2026-11-04', time: '11:00' }, ahora).motivoNoReagendar, /comenzó/);
});

test('revisión de inasistencias actualiza pendientes y pagadas confirmadas con fecha', async () => {
  const prueba = preparar();
  let consulta;
  const cantidad = await prueba.marcarInasistencias({ async query(sql, parametros) {
    consulta = { sql, parametros };
    return { rowCount: 2 };
  } });
  assert.equal(cantidad, 2);
  assert.match(consulta.sql, /estado IN \('pendiente', 'pagado'\)/);
  assert.match(consulta.sql, /estado_cupo = 'confirmada'/);
  assert.match(consulta.sql, /fecha <> ''/);
  assert.match(consulta.sql, /SET estado = 'no_asistio'/);
  assert.match(consulta.parametros[0], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
});