const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montarAsistencia, clasificarAsistencia } = require('./asistenciaService');

const inicio = new Date('2026-11-03T08:00:00Z');
const turno = { horaInicio: inicio, retardoMinutos: 5, faltaMinutos: 20 };
test('clasificación respeta límites explícitos del turno', () => {
  for (const [minutos, esperado] of [[-10, 'puntual'], [0, 'puntual'], [4.99, 'puntual'], [5, 'retardo'], [19.99, 'retardo'], [20, 'inasistencia']]) {
    assert.equal(clasificarAsistencia(new Date(+inicio + minutos * 60000), turno), esperado);
  }
  assert.equal(clasificarAsistencia(inicio, null), 'sin_turno');
});

function preparar({ habilitado = true, hoy = null, ultimo = null, existe = true, fallaInsert = false, turnoAsignado = turno } = {}) {
  const rutas = new Map();
  const consultas = [];
  let liberado = false;
  const db = {
    async query(sql, parametros = []) {
      consultas.push({ sql, parametros });
      if (sql.includes('CURRENT_TIMESTAMP AS ahora')) return { rows: [{ ahora: new Date(+inicio + 6 * 60000) }] };
      if (sql.includes('FROM webcobro.empleados') || sql.includes('FROM webcobro.clientes')) return { rows: existe ? [{ nombre: 'Persona', rol: 'recepción' }] : [] };
      if (sql.includes('FROM webcobro.turnos')) return { rows: turnoAsignado ? [turnoAsignado] : [] };
      if (sql.includes('SELECT tipo, creado_en')) return { rows: (sql.includes('CURRENT_DATE') ? hoy : ultimo) ? [sql.includes('CURRENT_DATE') ? hoy : ultimo] : [] };
      if (sql.includes('INSERT INTO')) {
        if (fallaInsert) throw Error('SQL simulado');
        return { rows: [{ id: 1, codigo: parametros[0], nombre: parametros[1], tipo: parametros[2], estado: parametros[3], creado_en: inicio }] };
      }
      return { rows: [] };
    },
    release() { liberado = true; },
  };
  const pool = { query: db.query, connect: async () => db };
  const app = { get(p, h) { rutas.set(`get ${p}`, h); }, post(p, h) { rutas.set(`post ${p}`, h); } };
  const servicio = montarAsistencia(app, pool, { turnosHabilitados: habilitado });
  const res = { codigo: 200, status(c) { this.codigo = c; return this; }, json(b) { this.body = b; return this; } };
  return { rutas, consultas, res, servicio, liberado: () => liberado };
}
async function marcar(p, codigo = 'EMP-101') {
  await p.rutas.get('post /api/asistencia/marcar')({ body: { codigo } }, p.res);
}
test('entrada del personal persiste retardo dentro de transacción', async () => {
  const p = preparar(); await marcar(p);
  assert.equal(p.res.body.estado, 'retardo');
  assert.equal(p.res.body.tipo, 'entrada');
  assert.ok(p.consultas.some(q => q.sql.includes('pg_advisory_xact_lock')));
  assert.ok(p.consultas.some(q => q.sql === 'COMMIT'));
  assert.ok(p.liberado());
});
test('salidas y socios no generan clasificación', async () => {
  const p = preparar({ hoy: { tipo: 'entrada', creado_en: inicio } }); await marcar(p);
  assert.equal(p.res.body.tipo, 'salida'); assert.equal(p.res.body.estado, null);
  const socio = preparar(); await marcar(socio, '3');
  assert.equal(socio.res.body.codigo, 'CLI-3'); assert.equal(socio.res.body.estado, null);
  assert.ok(!socio.consultas.some(q => q.sql.includes('FROM webcobro.turnos')));
});
test('modo anterior no requiere columnas nuevas ni tabla de turnos', async () => {
  const p = preparar({ habilitado: false }); await marcar(p);
  assert.equal(p.res.body.estado, null);
  assert.ok(!p.consultas.some(q => /automatica|FROM webcobro.turnos|tipo, estado/.test(q.sql)));
  await p.servicio.registrarInasistencias();
});
test('rechaza código inválido y persona inexistente sin insertar', async () => {
  const p = preparar(); await marcar(p, {}); assert.equal(p.res.codigo, 400);
  const n = preparar({ existe: false }); await marcar(n); assert.equal(n.res.codigo, 404);
  assert.ok(n.consultas.some(q => q.sql === 'ROLLBACK'));
  assert.ok(!n.consultas.some(q => q.sql.includes('INSERT INTO')));
});
test('conserva antispam de 60 segundos', async () => {
  const p = preparar({ ultimo: { tipo: 'entrada', creado_en: new Date(+inicio + 5.5 * 60000) } });
  await marcar(p); assert.equal(p.res.codigo, 429);
  assert.ok(!p.consultas.some(q => q.sql.includes('INSERT INTO')));
});
test('error SQL revierte y libera conexión', async () => {
  const p = preparar({ fallaInsert: true }); await marcar(p);
  assert.equal(p.res.codigo, 500);
  assert.ok(p.consultas.some(q => q.sql === 'ROLLBACK')); assert.ok(p.liberado());
});
test('consulta de persona devuelve horario y excluye faltas automáticas del estado físico', async () => {
  const p = preparar();
  await p.rutas.get('get /api/asistencia/empleado/:codigo')({ params: { codigo: 'EMP-101' } }, p.res);
  assert.equal(p.res.body.horaInicio, inicio.toISOString());
  assert.equal(p.res.body.siguienteTipo, 'entrada');
  assert.ok(p.consultas.filter(q => q.sql.includes('SELECT tipo')).every(q => q.sql.includes('NOT automatica')));
});
test('empleado sin turno sigue pudiendo checar', async () => {
  const p = preparar({ turnoAsignado: null }); await marcar(p);
  assert.equal(p.res.body.estado, 'sin_turno'); assert.equal(p.res.body.horaInicio, null);
});
test('cron usa bloqueo y evita duplicar incidencia o penalizar a quien entró', async () => {
  const consultas = [];
  const db = { async query(sql) { consultas.push(sql); return { rows: [] }; }, release() {} };
  const pool = { async query() { return { rows: [{ codigo: 'EMP-101', nombre: 'Persona', inicio, falta_minutos: 20 }] }; }, async connect() { return db; } };
  const servicio = montarAsistencia({ get() {}, post() {} }, pool, { turnosHabilitados: true });
  await servicio.registrarInasistencias();
  assert.ok(consultas.some(s => s.includes('pg_advisory_xact_lock')));
  const insert = consultas.find(s => s.includes('INSERT INTO'));
  assert.match(insert, /NOT EXISTS/); assert.match(insert, /tipo = 'entrada' OR automatica/);
  assert.match(insert, /CURRENT_TIMESTAMP >=/); assert.match(insert, /'inasistencia', true/);
  assert.equal(consultas.at(-1), 'COMMIT');
});