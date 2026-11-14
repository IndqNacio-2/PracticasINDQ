const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const source = fs.readFileSync(path.resolve(__dirname, '../src/components/CashClosingPage.tsx'), 'utf8');

function montar(overrides = {}) {
  const estados = []; let cursor = 0;
  const exports = {};
  const props = { sales: [], closings: [], initialFund: 0, countedCash: 0, onInitialFundChange() {}, onCountedCashChange() {}, onConfirmClosing() {}, ...overrides };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true,
  }).outputText, { exports, require(name) {
    if (name === 'react') return {
      useState(value) { const i = cursor++; if (!(i in estados)) estados[i] = value; return [estados[i], v => { estados[i] = v; }]; },
      useEffect() {}, useMemo: fn => fn(),
    };
    if (name === '../auth/session') return { getStoredUser: () => ({ idUsuario: 'vendedor-prueba' }) };
    if (name === './MaterialIcon') return { default: () => null };
    return require(name);
  } });
  return { props, render() { cursor = 0; return exports.default(props); } };
}
function nodos(n, list = []) {
  if (!n || typeof n !== 'object') return list;
  if (typeof n.type === 'function') return nodos(n.type(n.props), list);
  list.push(n); React.Children.forEach(n.props?.children, c => nodos(c, list)); return list;
}
const texto = n => typeof n === 'string' || typeof n === 'number' ? String(n) : React.Children.toArray(n?.props?.children).map(texto).join(' ');

test('corte comparte clases visuales, KPI horizontales y estados vacíos sin datos ficticios', () => {
  const tree = montar().render(); const nodes = nodos(tree);
  assert.equal(tree.props.className, 'rx-closing');
  const kpis = nodes.filter(n => n.type === 'article'); assert.equal(kpis.length, 5);
  for (const kpi of kpis) {
    const children = React.Children.toArray(kpi.props.children);
    assert.match(children[0].props.className, /rx-closing-kpi-icon/);
    assert.equal(children[1].props.className, 'rx-closing-kpi-copy');
  }
  assert.equal(nodes.find(n => n.type === 'button' && texto(n).includes('Realizar corte')).props.disabled, true);
  assert.match(texto(tree), /No hay ventas registradas/);
  assert.match(texto(tree), /No hay cortes registrados/);
  assert.doesNotMatch(source, /#[0-9a-f]{6}|style=\{/i);
});

test('rediseño conserva cálculos por método, fondo, conteo y confirmación del corte', () => {
  let saved; let fund; let counted;
  const sales = ['efectivo', 'tarjeta', 'transferencia'].map((paymentMethod, i) => ({ folio: `V-${i}`, date: '13/11/2026', time: '10:00', paymentMethod, total: [50, 70, 80][i] }));
  const app = montar({ sales, initialFund: 100, countedCash: 145, onConfirmClosing: c => { saved = c; }, onInitialFundChange: v => { fund = v; }, onCountedCashChange: v => { counted = v; } });
  let nodes = nodos(app.render());
  const inputs = nodes.filter(n => n.type === 'input');
  inputs[0].props.onChange({ target: { value: '200' } }); assert.equal(fund, 200);
  inputs[1].props.onChange({ target: { value: '' } }); assert.equal(counted, 0);
  nodes.find(n => n.type === 'button' && texto(n).includes('Realizar corte')).props.onClick();
  nodes = nodos(app.render());
  assert.equal(nodes.find(n => n.props?.role === 'dialog').props['aria-modal'], 'true');
  nodes.find(n => n.type === 'button' && texto(n) === 'Confirmar corte').props.onClick();
  assert.equal(saved.totalSales, 200); assert.equal(saved.cashSales, 50);
  assert.equal(saved.cardSales, 70); assert.equal(saved.transferSales, 80);
  assert.equal(saved.expectedCash, 150); assert.equal(saved.difference, -5);
  assert.equal(saved.initialFund, 100); assert.equal(saved.registeredBy, 'vendedor-prueba');
});

test('arqueo distingue caja exacta, sobrante y faltante y adapta layout y tablas', () => {
  for (const [countedCash, label] of [[100, 'Caja exacta'], [110, 'Sobrante'], [90, 'Faltante']]) {
    const status = nodos(montar({ initialFund: 100, countedCash }).render()).find(n => n.props?.role === 'status');
    assert.match(texto(status), new RegExp(label));
  }
  const css = fs.readFileSync(path.resolve(__dirname, '../src/styles/pos-ui.css'), 'utf8');
  assert.match(css, /\.rx-closing-kpi \{ display: flex; align-items: center;/);
  assert.match(css, /@media \(max-width: 899px\)/);
  assert.match(css, /\.rx-closing-table\.rx-table[^}]*border-spacing: 0 6px/);
});