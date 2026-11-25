const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const id = '6ae0fb852cd2070a58b23ce0';

function cargar(file, mocks = {}, globals = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, { module, exports: module.exports, process: { env: { JWT_SECRET: 'solo-pruebas' } },
    console, ...globals, require(name) { if (name in mocks) return mocks[name]; throw Error(`Importación no simulada: ${name}`); } });
  return module.exports;
}

function routerSimulado() {
  const rutas = [];
  const router = {};
  for (const method of ['use', 'get', 'post', 'patch', 'delete', 'put']) {
    router[method] = (...args) => { rutas.push({ method, args }); return router; };
  }
  return { router, rutas, express: { Router: () => router } };
}
function respuesta() {
  return { code: 200, body: undefined, locals: {}, status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }, send() { return this; } };
}
const pass = (_q, _s, next) => next();

function venta(producto = {}) {
  const calls = [];
  const client = { release() {}, async query(sql, args = []) {
    calls.push({ sql, args });
    if (/information_schema/.test(sql)) return { rows: [{ hasPayments: true }] };
    if (/SELECT id, name, price/.test(sql)) return { rows: [{ id: 1, name: 'Producto', price: 40, stock: 5, status: 'active', ...producto }] };
    if (/next_id/.test(sql)) return { rows: [{ next_id: 1 }] };
    return { rows: [{ id: 1 }], rowCount: 1 };
  } };
  const repo = cargar('backend/src/sales/sale.repository.ts', { '../config/postgres.js': { postgresPool: { connect: async () => client } } });
  return { repo, calls };
}
const inputVenta = items => ({ items, discount: 0, paymentMethod: 'efectivo', cashReceived: 500 });

test('venta rechaza producto inactivo sin guardar venta ni descontar existencias', async () => {
  const p = venta({ status: 'inactive' });
  assert.equal((await p.repo.insertSale(inputVenta([{ productId: 1, quantity: 1 }]), id)).outcome, 'inactive-product');
  assert.ok(p.calls.some(c => c.sql === 'ROLLBACK'));
  assert.equal(p.calls.some(c => /INSERT INTO|UPDATE /.test(c.sql)), false);
});
test('cantidades repetidas se validan acumuladas antes de cualquier escritura', async () => {
  const p = venta();
  assert.equal((await p.repo.insertSale(inputVenta([{ productId: 1, quantity: 3 }, { productId: 1, quantity: 3 }]), id)).outcome, 'insufficient-stock');
  assert.equal(p.calls.filter(c => /SELECT id, name, price/.test(c.sql)).length, 1);
  assert.equal(p.calls.some(c => /INSERT INTO|UPDATE /.test(c.sql)), false);
});
test('venta válida consolida el producto repetido y descuenta una sola vez', async () => {
  const p = venta();
  assert.equal((await p.repo.insertSale(inputVenta([{ productId: 1, quantity: 2 }, { productId: 1, quantity: 3 }]), id)).outcome, 'created');
  const updates = p.calls.filter(c => /UPDATE webpontoventa.products/.test(c.sql));
  assert.equal(updates.length, 1);
  assert.equal(updates[0].args[0], 5);
  assert.equal(p.calls.find(c => /INSERT INTO webpontoventa.sales/.test(c.sql)).args[3], 200);
});
test('venta rechaza efectivo omitido o insuficiente sin alterar existencias', async () => {
  for (const cashReceived of [undefined, 39.99]) {
    const p = venta();
    const body = { ...inputVenta([{ productId: 1, quantity: 1 }]), cashReceived };
    assert.equal((await p.repo.insertSale(body, id)).outcome, 'invalid-payment');
    assert.equal(p.calls.some(c => /INSERT INTO|UPDATE /.test(c.sql)), false);
  }
});
test('merma bloquea folios antes del producto, preserva transacción y autor', async () => {
  const calls = [];
  const client = { release() {}, async query(sql, args = []) {
    calls.push({ sql, args });
    if (/SELECT id, name, cost/.test(sql)) return { rows: [{ id: 1, name: 'Producto', cost: 10, stock: 5 }] };
    if (/next_id/.test(sql)) return { rows: [{ next_id: 7 }] };
    return { rows: [{ folio: 'M-000007', registeredBy: id }] };
  } };
  const repo = cargar('backend/src/waste/waste.repository.ts', { '../config/postgres.js': { postgresPool: { connect: async () => client } } });
  const { validateWasteInput } = cargar('backend/src/waste/waste.validation.ts');
  const input = validateWasteInput({ productId: 1, quantity: 2, reason: 'damaged', registeredBy: 'FALSO' }).input;
  assert.equal(input.registeredBy, '');
  await repo.insertWasteRecord({ ...input, registeredBy: id });
  assert.ok(calls.findIndex(c => /LOCK TABLE/.test(c.sql)) < calls.findIndex(c => /FOR UPDATE/.test(c.sql)));
  assert.equal(calls.find(c => /INSERT INTO/.test(c.sql)).args[6], id);
  assert.ok(calls.some(c => c.sql === 'COMMIT'));
});
test('ruta de mermas ignora autor enviado y utiliza la sesión verificada', async () => {
  const r = routerSimulado();
  let guardado;
  cargar('backend/src/waste/waste.routes.ts', { express: r.express,
    './waste.repository.js': { async insertWasteRecord(input) { guardado = input; return { outcome: 'created', record: { folio: 'M-1' } }; } },
    './waste.validation.js': { validateWasteInput: () => ({ issues: [], input: { registeredBy: 'FALSO' } }) },
    '../auth.js': { requirePosUser: pass },
  });
  const res = respuesta(); res.locals.posUser = { id };
  await r.rutas.find(r => r.method === 'post').args.at(-1)({ body: {} }, res);
  assert.equal(guardado.registeredBy, id);
});

test('Cobro exige token, valida roles y rechaza sesiones móviles en rutas de personal', () => {
  let token;
  const { accesoReservasCobros, accesoClientes } = cargar('backend-cobro/permisosPersonal.js', {
    jsonwebtoken: { verify() { if (!token) throw Error(); return token; } },
  });
  for (const [rol, permitido] of [['administrador', true], ['recepcion', true], ['vendedor', false], ['entrenador', false], ['cliente', false]]) {
    token = { sub: id, rol };
    const res = respuesta(); let next = false;
    accesoReservasCobros({ headers: { authorization: 'Bearer prueba' } }, res, () => { next = true; });
    assert.equal(next, permitido);
    if (!permitido) assert.equal(res.code, 403);
  }
  const res = respuesta(); accesoReservasCobros({ headers: {} }, res, () => assert.fail()); assert.equal(res.code, 401);
  token = { sub: '12', rol: 'cliente' };
  const movil = respuesta(); accesoClientes({ headers: { authorization: 'Bearer prueba' } }, movil, () => assert.fail());
  assert.equal(movil.code, 401);
});
test('autenticación administrativa rechaza payload incompleto y acepta Recepción', () => {
  let payload;
  const { requireAuth, requireRole } = cargar('backend-administrativa/src/middleware/auth.ts', { jsonwebtoken: { verify: () => payload } });
  for (const p of [{ rol: 'administrador' }, { sub: '12', rol: 'cliente' }, 'texto']) {
    payload = p; const res = respuesta();
    requireAuth({ headers: { authorization: 'Bearer prueba' } }, res, () => assert.fail());
    assert.equal(res.code, 401);
  }
  payload = { sub: id, rol: 'recepcion' };
  const req = { headers: { authorization: 'Bearer prueba' } }; let passed = false;
  requireAuth(req, respuesta(), () => requireRole('administrador', 'recepcion')(req, respuesta(), () => { passed = true; }));
  assert.equal(passed, true);
});

test('listado general de usuarios bloqueado para vendedor y catálogo mínimo para Recepción', async () => {
  const r = routerSimulado(); let fields;
  cargar('backend-administrativa/src/routes/usuarios.routes.ts', { express: r.express, bcryptjs: {}, mongoose: {},
    '../models/Usuarios/usuarios': { Usuario: { find() { return { select(value) { fields = value; return this; }, async sort() { return [{ _id: id, nombre: 'Ana', apellidos: 'Prueba', rol: 'entrenador', estatus: 'activo', correo: 'privado' }]; } }; } } },
    '../lib/foto-usuario': {}, '../lib/usuarios': {}, '../middleware/auth': { requireAuth: pass, requireRole: () => pass },
    '../../../shared/codigoUsuario': {},
  });
  const handler = r.rutas.find(r => r.method === 'get' && r.args[0] === '/').args.at(-1);
  for (const rol of ['vendedor', 'recepcion', 'entrenador']) {
    const res = respuesta(); await handler({ auth: { rol }, query: {} }, res); assert.equal(res.code, 403);
  }
  const res = respuesta(); await handler({ auth: { rol: 'recepcion' }, query: { rol: 'entrenador', estatus: 'activo' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body[0].correo, undefined);
  assert.equal(fields, '_id nombre apellidos rol estatus');
});
test('clientes históricos son solo lectura; no se crean fichas ni membresías paralelas', () => {
  const r = routerSimulado();
  cargar('backend-administrativa/src/routes/clientes.routes.ts', { express: r.express,
    '../models/Clientes/cliente': {}, '../lib/correo': {},
  });
  const guard = r.rutas.find(r => r.method === 'use').args[0];
  for (const method of ['POST', 'PATCH', 'DELETE']) {
    const res = respuesta(); guard({ method }, res, () => assert.fail()); assert.equal(res.code, 409);
  }
  let next = false; guard({ method: 'GET' }, respuesta(), () => { next = true; }); assert.equal(next, true);
});

test('las rutas privadas de Cobro quedan protegidas antes de registrarse; frontend envía token', () => {
  const backend = fs.readFileSync(path.join(root, 'backend-cobro/serverWebCobro.js'), 'utf8');
  assert.ok(backend.indexOf("app.use(['/api/reservas', '/api/cobros', '/api/kpis'], accesoReservasCobros)") < backend.indexOf("app.get('/api/reservas'"));
  assert.match(backend, /const usuario = req\.personal\.id/);
  const dashboard = fs.readFileSync(path.join(root, 'src/sections/webCobro/pages/dashboard.jsx'), 'utf8');
  assert.doesNotMatch(dashboard, /\bfetch\(`\$\{API\}/);
  assert.match(dashboard, /Authorization: `Bearer \$\{localStorage.getItem\(TOKEN_KEY\)/);
  const admin = fs.readFileSync(path.join(root, 'backend-administrativa/src/server.ts'), 'utf8');
  assert.match(admin, /app.use\('\/api\/reservaciones', requireAuth, requireRole\('administrador', 'recepcion'\)\)/);
});

test('adaptador administrativo reenvía la sesión a Recepción al modificar una reserva', async () => {
  const r = routerSimulado(); let forwarded;
  cargar('backend-administrativa/src/routes/reservaciones.routes.ts', { express: r.express,
    '../models/Reservaciones/reservacion': {}, '../models/Horarios/horarios': {}, '../lib/validacion': {},
  }, { AbortSignal, fetch: async (url, options) => {
    forwarded = { url, options }; return { status: 200, json: async () => ({ ok: true }) };
  } });
  const handler = r.rutas.find(r => r.method === 'patch').args.at(-1);
  const res = respuesta();
  await handler({ params: { id: '12' }, headers: { authorization: 'Bearer prueba' }, body: { estatus: 'cancelada' } }, res);
  assert.equal(forwarded.options.headers.Authorization, 'Bearer prueba');
  assert.equal(JSON.parse(forwarded.options.body).status, 'cancelado');
  assert.equal(res.code, 200);
});

test('HTTP real aislado: reservas, cobros y KPIs requieren sesión y rol antes de consultar datos', async () => {
  const { createRequire } = require('node:module');
  const backendRequire = createRequire(path.join(root, 'backend/package.json'));
  const jwt = backendRequire('jsonwebtoken');
  const permisos = cargar('backend-cobro/permisosPersonal.js', { jsonwebtoken: jwt });
  let consultas = 0;
  class Pool {
    on() {}
    query(sql) {
      if (sql === 'SELECT 1') return new Promise(() => {}); // Nunca ejecuta el arranque/migraciones.
      consultas++;
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
  }
  const app = cargar('backend-cobro/serverWebCobro.js', {
    'dotenv/config': {}, 'node:crypto': require('node:crypto'), 'node:fs': fs, 'node:path': path,
    express: backendRequire('express'), cors: backendRequire('cors'), pg: { Pool },
    './ticketService': {}, './reservasFlujo': {}, './validacionCliente': {}, './saludCliente': {},
    './codigoCliente': {}, './menoresCliente': {}, './permisosPersonal': permisos,
    './membresiasService': { registrarRutas() {} }, './codigosReserva': {},
    './asistenciaService': { montarAsistencia: () => ({}) }, './accesoChecador': { accesoChecador: pass },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    for (const endpoint of ['/api/reservas', '/api/kpis', '/api/cobros']) {
      const options = endpoint.endsWith('cobros') ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' } : {};
      assert.equal((await fetch(url + endpoint, options)).status, 401);
      for (const rol of ['vendedor', 'entrenador']) {
        const token = jwt.sign({ rol }, 'solo-pruebas', { subject: id });
        assert.equal((await fetch(url + endpoint, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } })).status, 403);
      }
    }
    assert.equal(consultas, 0);
    for (const rol of ['administrador', 'recepcion']) {
      const token = jwt.sign({ rol }, 'solo-pruebas', { subject: id });
      const res = await fetch(url + '/api/cobros', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' });
      assert.equal(res.status, 400); // Llegó a la validación, no al acceso denegado.
    }
    assert.equal(consultas, 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});