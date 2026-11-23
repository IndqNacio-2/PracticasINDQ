const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validarMixto } = require('../backend-cobro/pagoMixto');
const body = { metodoPago: 'mixto', payments: [{ method: 'efectivo', amount: 50 }, { method: 'tarjeta', amount: 150 }], efectivoRecibido: 100 };
test('Recepción: efectivo y tarjeta suman total, cambio solo sobre efectivo', () => {
  const r = validarMixto(body, 200); assert.equal(r.cambio, 50); assert.equal(r.pagos[1].monto, 150);
});
test('Recepción: transferencia conserva referencia', () => {
  const r = validarMixto({ ...body, payments: [body.payments[0], { method: 'transferencia', amount: 150 }], referencia: ' REF ' }, 200);
  assert.equal(r.referencia, 'REF');
});
test('Recepción: rechaza sumas incorrectas, duplicados, importes inválidos y efectivo insuficiente', () => {
  for (const payments of [[], [{ method: 'efectivo', amount: 100 }, { method: 'efectivo', amount: 100 }],
    [{ method: 'efectivo', amount: -1 }, { method: 'tarjeta', amount: 201 }],
    [{ method: 'efectivo', amount: 1.001 }, { method: 'tarjeta', amount: 198.999 }]]) assert.throws(() => validarMixto({ ...body, payments }, 200));
  assert.throws(() => validarMixto(body, 201));
  assert.throws(() => validarMixto({ ...body, efectivoRecibido: 49 }, 200));
});
function servidor(disponible) {
  const root = path.resolve(__dirname, '..'), calls = [], routes = [];
  const app = { use() {}, get() {}, patch() {}, delete() {}, post(route, fn) { routes.push({ route, fn }); } };
  const reserva = { id: 1, cliente: 'Cliente', cliente_id: 7, tipo: 'cliente', estado: 'pendiente', estado_pago: 'pendiente', estado_cupo: 'confirmada', precio: '200.00' };
  const db = { release() {}, async query(sql, args) {
    calls.push({ sql, args });
    if (/FROM webcobro.reservas/.test(sql)) return { rows: [reserva] };
    if (/information_schema/.test(sql)) return { rows: [{ disponible }] };
    if (/to_char/.test(sql)) return { rows: [{ fecha: '20261123' }] };
    if (/AS numero/.test(sql)) return { rows: [{ numero: 1 }] };
    if (/INSERT INTO/.test(sql)) return { rows: [{ id: 1, folio: 'NCC-1', monto: 200, metodo_pago: 'mixto', efectivo_recibido: 100, cambio: 50, creado_en: new Date() }] };
    return { rows: [{ id: 1 }] };
  } };
  class Pool { on() {} connect() { return Promise.resolve(db); } query() { return new Promise(() => {}); } }
  const mocks = { 'dotenv/config': {}, 'node:crypto': require('node:crypto'), 'node:fs': fs, 'node:path': path,
    express: () => app, cors: () => () => {}, pg: { Pool }, './ticketService': { imprimirTicket: async () => false },
    './reservasFlujo': { marcarInasistencias: async () => 0, decorarReserva: x => x }, './validacionCliente': {}, './saludCliente': {},
    './codigoCliente': {}, './menoresCliente': {}, './permisosPersonal': {}, './membresiasService': { registrarRutas() {} },
    './codigosReserva': {}, './asistenciaService': { montarAsistencia: () => ({}) }, './accesoChecador': {}, './pagoMixto': { validarMixto } };
  mocks.express.json = () => () => {};
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'backend-cobro/serverWebCobro.js'), 'utf8'), {
    module, exports: module.exports, __dirname: path.join(root, 'backend-cobro'), process: { env: {} }, console,
    require(name) { if (name in mocks) return mocks[name]; throw Error(name); },
  });
  return { calls, fn: routes.find(r => r.route === '/api/cobros').fn };
}
test('ruta guarda desglose y devuelve ticket; esquema antiguo rechaza antes de escribir', async () => {
  for (const disponible of [false, true]) {
    const s = servidor(disponible);
    const res = { status(n) { this.code = n; return this; }, json(b) { this.body = b; } };
    await s.fn({ body: { ...body, reservaId: 1 }, personal: { id: 'personal' } }, res);
    assert.equal(res.code, disponible ? 201 : 409);
    const insert = s.calls.find(c => /INSERT INTO/.test(c.sql));
    if (!disponible) assert.equal(insert, undefined);
    else { assert.equal(JSON.parse(insert.args[10])[1].monto, 150); assert.equal(res.body.ticket.pagos[0].monto, 50); }
  }
});
test('ticket físico incluye ambos métodos', () => {
  const { crearContenidoTicket } = require('../backend-cobro/ticketService');
  const contenido = crearContenidoTicket({ fecha: new Date(), total: 200, pagos: validarMixto(body, 200).pagos }).toString();
  assert.match(contenido, /Pago efectivo/); assert.match(contenido, /Pago tarjeta/);
});