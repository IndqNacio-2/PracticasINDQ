const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const root = path.resolve(__dirname, '..');
const backendRoot = fs.existsSync(path.join(root, 'backend')) ? root : path.resolve(root, '..');
const jwt = require(path.join(backendRoot, 'backend/node_modules/jsonwebtoken'));
function cargar(file, imports, globals = {}) {
  const exports = {};
  const base = file.startsWith('backend/') ? backendRoot : root;
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(base, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, ...globals, require: name => imports[name] ?? require(name) });
  return exports;
}
function nodos(n, lista = []) { if (!n || typeof n !== 'object') return lista; lista.push(n); React.Children.forEach(n.props?.children, c => nodos(c, lista)); return lista; }

test('identidad POS proviene del token firmado y rechaza sesión ausente o rol ajeno', () => {
  const secret = 'secreto-exclusivo-pruebas';
  const { requirePosUser } = cargar('backend/src/auth.ts', { jsonwebtoken: jwt }, { process: { env: { JWT_SECRET: secret } } });
  for (const [rol, status] of [['vendedor', 200], ['administrador', 200], ['recepcion', 403]]) {
    const token = jwt.sign({ rol }, secret, { subject: 'vendedor-A' });
    const res = { locals: {}, status(n) { this.code = n; return this; }, json() {} }; let next = false;
    requirePosUser({ headers: { authorization: `Bearer ${token}` } }, res, () => { next = true; });
    assert.equal(next, status === 200);
    if (next) assert.equal(res.locals.posUser.id, 'vendedor-A'); else assert.equal(res.code, status);
  }
  const res = { locals: {}, status(n) { this.code = n; return this; }, json() {} };
  requirePosUser({ headers: {} }, res, () => assert.fail()); assert.equal(res.code, 401);
});

test('consultar ventas y cortes filtra por vendedor sin atribuir registros históricos', async () => {
  const llamadas = [];
  const pool = { query: async (sql, params) => { llamadas.push({ sql, params }); return { rows: [] }; } };
  const ventas = cargar('backend/src/sales/sale.repository.ts', { '../config/postgres.js': { postgresPool: pool } });
  const cortes = cargar('backend/src/cash-closings/cash-closing.repository.ts', { '../config/postgres.js': { postgresPool: pool } });
  await ventas.listSales('A'); await ventas.listSales('B'); await cortes.listCashClosings('A');
  assert.equal(llamadas[0].params[0], 'A'); assert.equal(llamadas[1].params[0], 'B');
  llamadas.forEach(c => assert.match(c.sql, /seller_id = \$1/));
  assert.match(llamadas[0].sql, /cash_closing_id AS "cashClosingId"/);
});

test('corte calcula totales reales y marca ventas del dueño dentro de la misma transacción', async () => {
  const llamadas = [];
  const client = { release() {}, async query(sql, params) {
    llamadas.push({ sql, params });
    if (sql.includes('SELECT id, total')) return { rows: [{ id: 1, total: 50, payment_method: 'efectivo' }] };
    if (sql.includes('next_id')) return { rows: [{ next_id: 1 }] };
    if (sql.includes('INSERT INTO')) return { rows: [{ id: 8 }] };
    if (sql.includes('UPDATE webpontoventa.sales')) return { rowCount: 1 };
    return { rows: [{ id: 8 }] };
  } };
  const repo = cargar('backend/src/cash-closings/cash-closing.repository.ts', { '../config/postgres.js': { postgresPool: { connect: async () => client } } });
  await repo.insertCashClosing({ salesCount: 1, totalSales: 999, cashSales: 999, initialFund: 20, countedCash: 70, registeredBy: 'A' }, 'A', [1]);
  const insert = llamadas.find(c => c.sql.includes('INSERT INTO'));
  assert.equal(insert.params[2], 50); assert.equal(insert.params[7], 70); assert.equal(insert.params[9], 0);
  const update = llamadas.find(c => c.sql.includes('UPDATE webpontoventa.sales'));
  assert.equal(update.params[1], 'A'); assert.match(update.sql, /cash_closing_id IS NULL/);
  assert.equal(llamadas.at(-1).sql, 'COMMIT');
});

test('fondo opcional se guarda por usuario sin mostrar barra persistente ni borrar el importe', () => {
  const datos = new Map([['token', 'sesion-1']]); const sesion = new Map();
  const storage = map => ({ getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) });
  const fondos = cargar('src/services/fondoVendedor.ts', {}, { localStorage: storage(datos) });
  let estados = []; let cursor = 0;
  const { default: Fondo } = cargar('src/components/FondoRecordatorio.tsx', {
    react: { useState(v) { const i = cursor++; if (!(i in estados)) estados[i] = typeof v === 'function' ? v() : v; return [estados[i], n => { estados[i] = n; }]; } },
    '../auth/session': { TOKEN_KEY: 'token' }, './MaterialIcon': { default: () => null },
  }, { localStorage: storage(datos), sessionStorage: storage(sesion) });
  const render = userId => { cursor = 0; return Fondo({ userId, amount: fondos.leerFondoVendedor(userId), onChange: amount => fondos.guardarFondoVendedor(userId, amount) }); };
  let tree = render('A'); assert.ok(nodos(tree).find(n => n.props?.role === 'dialog'));
  nodos(tree).find(n => n.type === 'input').props.onChange({ target: { value: '-1' } });
  nodos(render('A')).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(datos.has('pos:fondo-recordatorio:A'), false);
  nodos(render('A')).find(n => n.type === 'input').props.onChange({ target: { value: '200' } });
  nodos(render('A')).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(datos.get('pos:fondo-recordatorio:A'), '200');
  tree = render('A'); assert.equal(nodos(tree).some(n => n.props?.role === 'dialog'), false);
  assert.equal(nodos(tree).some(n => n.props?.className === 'rx-fund-reminder'), false);
  assert.equal(nodos(tree).some(n => n.type === 'button'), false);
  assert.equal(datos.get('pos:fondo-recordatorio:A'), '200');
  datos.set('pos:fondo-recordatorio:A', '300'); estados = [];
  render('B'); assert.equal(fondos.leerFondoVendedor('B'), null); assert.equal(estados[0], true);
  estados = []; datos.set('token', 'sesion-2'); render('A'); assert.equal(fondos.leerFondoVendedor('A'), 300); assert.equal(estados[0], true);
});

test('captura inicial y corte comparten fondo persistido; se limpia únicamente tras guardar el corte', () => {
  const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  assert.match(app, /leerFondoVendedor\(sessionUser.idUsuario\)/);
  assert.match(app, /amount=\{initialFund\} onChange=\{changeInitialFund\}/);
  assert.match(app, /initialFund=\{initialFund \?\? 0\}/);
  assert.match(app, /onInitialFundChange=\{changeInitialFund\}/);
  assert.ok(app.indexOf('setInitialFund(null)') > app.indexOf('await createCashClosing('));
  const corte = fs.readFileSync(path.join(root, 'src/components/CashClosingPage.tsx'), 'utf8');
  assert.match(corte, /useEffect\(\(\) => \{\s*setInitialFundText\(initialFund === 0 \? "" : String\(initialFund\)\);\s*\}, \[initialFund\]\)/);
});