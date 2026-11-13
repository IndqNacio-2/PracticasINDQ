const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function montar(bottom = 140) {
  const efectos = []; const limpiezas = []; const eventos = new Map();
  let posicion; let cierres = 0; let focos = 0;
  const menu = { offsetWidth: 210, offsetHeight: 200, contains: target => target === 'menu' };
  const anchor = { getBoundingClientRect: () => ({ top: bottom - 40, bottom, right: 960 }), contains: target => target === 'anchor', focus() { focos++; } };
  const document = { body: {}, addEventListener: (n, fn) => eventos.set(n, fn), removeEventListener: n => eventos.delete(n) };
  const window = { innerWidth: 1000, innerHeight: 600, addEventListener: (n, fn) => eventos.set(n, fn), removeEventListener: n => eventos.delete(n) };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/components/inventory/InventoryActionMenu.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, document, window, require(n) {
    if (n === 'react') return { useRef: () => ({ current: menu }), useState: () => [{ top: 0, left: 0, ready: false }, v => { posicion = v; }], useLayoutEffect: fn => efectos.push(fn) };
    if (n === 'react-dom') return { createPortal: (node, container) => ({ node, container }) };
    return require(n);
  } });
  const portal = exports.default({ anchor, id: 'inventory-actions-1', label: 'Opciones', onClose() { cierres++; }, children: 'Acciones' });
  efectos.forEach(fn => limpiezas.push(fn()));
  return { portal, document, eventos, posicion, cierres: () => cierres, focos: () => focos, limpiar: () => limpiezas.forEach(fn => fn()) };
}

test('menú se monta fuera de la tabla y se ancla debajo del botón', () => {
  const app = montar();
  assert.equal(app.portal.container, app.document.body);
  assert.equal(app.posicion.top, 148); assert.equal(app.posicion.left, 750);
  assert.equal(app.portal.node.props.id, 'inventory-actions-1');
  const css = fs.readFileSync(path.join(root, 'src/styles/pos-ui.css'), 'utf8');
  assert.match(css, /\.rx-inventory-action-menu\s*\{ position: fixed; z-index:/);
  app.limpiar(); assert.equal(app.eventos.size, 0);
});

test('menú abre arriba cuando no cabe debajo y conserva cierre y foco', () => {
  const app = montar(580);
  assert.equal(app.posicion.top, 332);
  app.eventos.get('mousedown')({ target: 'menu' });
  app.eventos.get('mousedown')({ target: 'anchor' });
  assert.equal(app.cierres(), 0);
  app.eventos.get('mousedown')({ target: 'outside' });
  assert.equal(app.cierres(), 1);
  app.eventos.get('keydown')({ key: 'Escape', preventDefault() {} });
  assert.equal(app.cierres(), 2); assert.equal(app.focos(), 1);
  assert.equal(typeof app.eventos.get('scroll'), 'function');
  assert.equal(typeof app.eventos.get('resize'), 'function');
  app.limpiar();
});