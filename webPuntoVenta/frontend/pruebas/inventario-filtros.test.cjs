const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function montar() {
  const estados = []; let cursor = 0;
  const exports = {};
  const filename = path.resolve(__dirname, '../src/components/InventoryPage.tsx');
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require(nombre) {
    if (nombre === 'react') return {
      useState(valor) { const i = cursor++; if (!(i in estados)) estados[i] = valor; return [estados[i], v => { estados[i] = v; }]; },
      useMemo: fn => fn(), useRef: () => ({ current: null }),
    };
    if (nombre === 'react/jsx-runtime') return require(nombre);
    if (nombre === '../data') return { CATEGORIES: ['Todos', 'Bebidas'] };
    return { default: () => null };
  } });
  const props = { products: [{ id: 1, name: 'Agua', code: 'A1', category: 'Bebidas', price: 25, stock: 10, minimumStock: 2, status: 'active' }], addToast() {} };
  return { estados, render() { cursor = 0; return exports.default(props); } };
}
function nodos(nodo, lista = []) {
  if (!nodo || typeof nodo !== 'object') return lista;
  lista.push(nodo); React.Children.forEach(nodo.props?.children, hijo => nodos(hijo, lista));
  return lista;
}
const botonesLimpiar = arbol => nodos(arbol).filter(n => n.type === 'button' && n.props.children === 'Limpiar filtros');

test('los cuatro KPI agrupan número y etiqueta al lado del icono y conservan el filtro rápido', () => {
  const app = montar();
  const tarjetas = () => nodos(app.render()).filter(n => n.type === 'button' && n.props.className?.startsWith('rx-inventory-kpi '));
  assert.equal(tarjetas().length, 4);
  for (const tarjeta of tarjetas()) {
    const hijos = React.Children.toArray(tarjeta.props.children);
    assert.equal(hijos[0].props.className, 'rx-inventory-kpi-icon');
    assert.equal(hijos[1].props.className, 'rx-inventory-kpi-copy');
    assert.ok(nodos(hijos[1]).some(n => n.props?.className === 'rx-inventory-kpi-value'));
    assert.ok(nodos(hijos[1]).some(n => n.props?.className === 'rx-inventory-kpi-label'));
  }
  tarjetas()[0].props.onClick();
  assert.equal(tarjetas()[0].props['aria-pressed'], true);
  assert.ok(nodos(tarjetas()[0]).some(n => n.props?.children === 'Filtro activo'));
  tarjetas()[0].props.onClick();
  assert.equal(tarjetas()[0].props['aria-pressed'], false);
  const css = fs.readFileSync(path.resolve(__dirname, '../src/styles/pos-ui.css'), 'utf8');
  assert.match(css, /\.rx-inventory-kpi \{ display: flex; align-items: center; gap: 14px;/);
});

test('inventario muestra limpiar al modificar cualquier filtro u orden y restablece todos', () => {
  const app = montar();
  assert.equal(botonesLimpiar(app.render()).length, 0);
  for (const [indice, valor] of [[0, 'Agua'], [1, 'Bebidas'], [2, 'available'], [3, 'price-desc'], [4, 'active']]) {
    app.estados[indice] = valor;
    const [boton] = botonesLimpiar(app.render());
    assert.ok(boton); assert.equal(boton.props.className, 'rx-btn rx-btn--outline');
    boton.props.onClick();
    assert.deepEqual(app.estados.slice(0, 6), ['', 'Todas', 'all', 'name', 'all', null]);
    assert.equal(botonesLimpiar(app.render()).length, 0);
  }
});

test('limpiar desde estado vacío elimina filtros combinados y recupera el catálogo', () => {
  const app = montar(); app.render();
  Object.assign(app.estados, { 0: 'sin coincidencias', 1: 'Bebidas', 2: 'out', 3: 'stock-desc', 4: 'inactive' });
  const botones = botonesLimpiar(app.render());
  assert.equal(botones.length, 2);
  botones[1].props.onClick();
  const arbol = app.render();
  assert.equal(botonesLimpiar(arbol).length, 0);
  assert.equal(nodos(arbol).filter(n => n.type === 'table').length, 1);
});