const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function cargar(query) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../backend-administrativa/src/services/reservas-protegidas.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, { module, exports: module.exports,
    require(name) { assert.equal(name, '../lib/post'); return { pool: { query } }; },
    fetch() { throw Error('No se debe llamar por HTTP a Cobro'); } });
  return module.exports;
}

test('horarios obtienen reservas del PostgreSQL compartido sin token ni HTTP', async () => {
  const rows = [{ horarioId: 'h1', capacityStatus: 'confirmada', class: 'Yoga', time: '10:00', fecha: '2026-11-23', status: 'pagado' }];
  const servicio = cargar(async sql => {
    assert.match(sql, /FROM webcobro\.reservas/);
    assert.match(sql, /horario_id AS "horarioId"/);
    assert.match(sql, /estado_cupo AS "capacityStatus"/);
    return { rows };
  });
  assert.equal(await servicio.obtenerDetalleReservas(), rows);
  const reservas = servicio.reservasDeHorario(rows, { idHorario: 'h1' });
  assert.equal(servicio.ocupacionReal(reservas), 1);
  assert.equal((await servicio.obtenerReservasProtegidas()).has('Yoga|2026-11-23|10:00'), true);
});

test('ocupación excluye lista de espera, canceladas e inasistencias', () => {
  const servicio = cargar(async () => ({ rows: [] }));
  assert.equal(servicio.ocupacionReal([
    { status: 'pagado', capacityStatus: 'confirmada' },
    { status: 'pendiente', capacityStatus: 'espera' },
    { status: 'cancelado' }, { status: 'cancelada' }, { status: 'no_asistio' },
  ]), 1);
});

test('reservas históricas sin horario conservan correspondencia por clase, fecha y hora', () => {
  const servicio = cargar(async () => ({ rows: [] }));
  assert.equal(servicio.reservasDeHorario([{ class: 'Yoga', fecha: '2026-11-23', time: '10:00' }],
    { nombreClase: 'Yoga', fecha: '2026-11-23', horaInicio: '10:00' }).length, 1);
});

test('fallo de base no se disimula como ausencia de reservas', async () => {
  const servicio = cargar(async () => { throw Error('Base no disponible'); });
  await assert.rejects(servicio.obtenerDetalleReservas(), /Base no disponible/);
  await assert.rejects(servicio.obtenerReservasProtegidas(), /no se hizo ningun cambio/);
});