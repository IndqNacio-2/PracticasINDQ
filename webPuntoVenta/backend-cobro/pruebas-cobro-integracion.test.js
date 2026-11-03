const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Carga el servidor con PostgreSQL, Express e impresora simulados: no abre puertos
// ni ejecuta SQL real. Comprueba que la adaptación conserva el flujo transaccional.
function preparar(estadoCupo = 'confirmada', impresion = Promise.resolve(false)) {
  const rutas = new Map();
  const consultas = [];
  const impresiones = [];
  const reserva = { id: 1, cliente: 'Socio', tipo: 'cliente', clase: 'Yoga', hora: '12:00', fecha: '2026-11-04', estado: 'pendiente', estado_cupo: estadoCupo, precio: 180 };
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
    async query() { return { rows: [] }; }
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
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'serverWebCobro.js'), 'utf8'), contexto);
  const respuesta = { codigo: 200, cuerpo: null, status(codigo) { this.codigo = codigo; return this; }, json(cuerpo) { this.cuerpo = cuerpo; return this; } };
  return { cobrar: rutas.get('post /api/cobros'), consultas, impresiones, respuesta };
}

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