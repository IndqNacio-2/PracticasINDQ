const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('../frontend/node_modules/typescript');
const root = path.resolve(__dirname, '..');
const reqAdmin = createRequire(path.join(root, 'backend-administrativa/package.json'));
const express = reqAdmin('express');
const jwt = reqAdmin('jsonwebtoken');
const secret = 'pruebas-clientes-independiente-0123456789';
function cargar(file, mocks) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
  { module, exports: module.exports, console, Buffer, process: { env: { JWT_SECRET: 'personal' } },
    require(name) { if (name in mocks) return mocks[name]; throw Error('Importación sin simular: ' + name); } });
  return module.exports;
}
async function ejecutar(fn) {
  const calls = [];
  const pool = { async query(sql, args) {
    calls.push({ sql, args });
    if (/JOIN webcobro.clientes_acceso_movil/.test(sql)) return { rows: [{ id: 7, activo: true, token_version: 2 }] };
    if (/GROUP BY horario_id/.test(sql)) return { rows: [{ horario_id: 'h1', ocupados: 4 }] };
    return { rows: [] };
  } };
  const filtros = [];
  function modelo(rows) { return { find(filtro) { filtros.push(filtro); const q = {};
    for (const method of ['select', 'sort', 'skip', 'limit']) q[method] = () => q;
    q.lean = async () => rows; q.then = (ok, fail) => Promise.resolve(rows).then(ok, fail); return q; } }; }
  const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const consultas = cargar('backend-administrativa/src/routes/consulta-movil.routes.ts', {
    express, '../lib/asynchandler': { asyncHandler },
    '../models/Clases/clases': { Clase: modelo([{ _id: 'c1', nombre: 'Clase' }]) },
    '../models/Usuarios/usuarios': { Usuario: modelo([{ _id: 'e1' }]) },
    '../models/Horarios/horarios': { Horario: modelo([{ _id: 'h1', capacidadTotal: 3 }]) },
    '../models/Membresia/membresia.model': { Membresia: modelo([{ toJSON: () => ({ idMembresia: 'm1' }) }]) },
  });
  const rutas = cargar('backend-administrativa/src/routes/clientes-movil.routes.ts', {
    express, bcryptjs: reqAdmin('bcryptjs'), jsonwebtoken: jwt, 'node:crypto': require('node:crypto'),
    '../lib/cliente-compartido': {}, '../lib/asynchandler': { asyncHandler },
    '../middleware/auth': { requireAuth: (_q, _s, n) => n(), requireRole: () => (_q, _s, n) => n() },
    './consulta-movil.routes': consultas,
  });
  const app = express(); app.use(express.json()); app.use('/api/movil', rutas.crearRutasClientesMovil(pool, () => secret));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const token = tv => jwt.sign({ rol: 'cliente', tv }, secret, { subject: '7', audience: 'clientes-postgres', issuer: 'clientes-compartidos' });
  const get = (url, auth = token(2)) => fetch(`http://127.0.0.1:${server.address().port}/api/movil${url}`,
    { headers: auth ? { Authorization: `Bearer ${auth}` } : {} });
  try { await fn({ get, calls, filtros, token }); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('todas las consultas móviles exigen sesión de cliente', () => ejecutar(async ({ get, calls }) => {
  for (const route of ['/clases', '/horarios', '/membresias', '/membresias/mis-compras', '/reservaciones']) {
    const r = await get(route, ''); assert.equal(r.status, 401); assert.equal(r.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls.length, 0);
}));
test('token revocado no accede a consultas móviles', () => ejecutar(async ({ get, token }) => {
  assert.equal((await get('/reservaciones', token(1))).status, 401);
}));
test('reservaciones y compras se filtran por identidad, no por clienteId enviado', () => ejecutar(async ({ get, calls }) => {
  for (const route of ['/reservaciones', '/membresias/mis-compras']) {
    assert.equal((await get(route + '?clienteId=999')).status, 200);
    const call = calls.at(-1); assert.match(call.sql, /WHERE cliente_id = \$1/); assert.equal(call.args[0], 7);
  }
}));
test('catálogos de clases y membresías solo solicitan activos', () => ejecutar(async ({ get, filtros }) => {
  for (const route of ['/clases', '/membresias']) {
    assert.equal((await get(route)).status, 200); assert.equal(filtros.at(-1).estatus, 'activo');
  }
}));
test('horarios calculan cupo real sin valores negativos y sin datos del entrenador', () => ejecutar(async ({ get, calls, filtros }) => {
  const r = await get('/horarios?desde=2026-11-23&hasta=2026-11-24'); assert.equal(r.status, 200);
  const [h] = await r.json(); assert.equal(h.capacidadDisponible, 0); assert.equal(h.entrenadorId, undefined);
  assert.match(calls.at(-1).sql, /estado_cupo = 'confirmada'/);
  assert.equal(filtros.at(-1).visibleReservas, true);
}));
test('fechas, intervalos, clase y paginación inválidos se rechazan', () => ejecutar(async ({ get }) => {
  for (const q of ['desde=2026-02-30', 'desde=2026-01-01&hasta=2026-03-01', 'idClase=incorrecto', 'limite=101', 'pagina=0']) {
    assert.equal((await get('/horarios?' + q)).status, 400, q);
  }
}));