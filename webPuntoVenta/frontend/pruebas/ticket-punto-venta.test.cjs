const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const carpeta = path.resolve(__dirname, '../src/components');

function cargar(nombre, window = {}) {
  const modulo = { exports: {} };
  const fuente = fs.readFileSync(path.join(carpeta, `${nombre}.tsx`), 'utf8');
  vm.runInNewContext(ts.transpileModule(fuente, { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText, { module: modulo, exports: modulo.exports, window,
    require: nombre => nombre === './MaterialIcon' ? cargar('MaterialIcon') : require(nombre) });
  return modulo.exports;
}
const venta = { folio: 'V-123', date: '05/11/2026', time: '15:30',
  items: [{ name: 'Agua', qty: 2, unitPrice: 20, subtotal: 40 }],
  subtotal: 40, discount: 5, total: 35, paymentMethod: 'efectivo', cashReceived: 50, change: 15 };

test('ticket POS usa el diseño de Cobro conservando productos y pago', () => {
  const Ticket = cargar('TicketModal').default;
  const html = renderToStaticMarkup(React.createElement(Ticket, { sale: venta, onClose() {}, onNewSale() {} }));
  for (const texto of ['role="dialog"', 'rx-modal-header', 'rx-modal-footer', 'rx-receipt-brand', 'NUUCLEO',
    'rx-receipt-section', 'rx-receipt-total', 'V-123', 'Agua', 'Subtotal', 'Descuento', '$35.00', '$15.00', 'Efectivo', 'Imprimir']) {
    assert.ok(html.includes(texto), texto);
  }
  assert.doesNotMatch(html, /migimnasio|CENTRO DE ENTRENAMIENTO/);
  const tarjeta = renderToStaticMarkup(React.createElement(Ticket, { sale: { ...venta, paymentMethod: 'tarjeta', cashReceived: undefined, change: undefined }, onClose() {}, onNewSale() {} }));
  assert.doesNotMatch(tarjeta, /Recibido:|Cambio:/);
});

test('impresión POS mantiene formato térmico y escapa texto externo', () => {
  let documento = '';
  let cerrado = false;
  const Ticket = cargar('TicketModal', { open: () => ({ document: {
    write: html => { documento = html; }, close: () => { cerrado = true; },
  } }) }).default;
  const arbol = Ticket({ sale: { ...venta, items: [{ ...venta.items[0], name: '<script>externo</script>' }] }, onClose() {}, onNewSale() {} });
  const botones = [];
  function recorrer(nodo) {
    if (!nodo || typeof nodo !== 'object') return;
    if (Array.isArray(nodo)) return nodo.forEach(recorrer);
    if (nodo.type === 'button') botones.push(nodo);
    recorrer(nodo.props?.children);
  }
  recorrer(arbol);
  botones.find(b => b.props.children?.some?.(h => typeof h === 'string' && h.includes('Imprimir'))).props.onClick();
  assert.equal(cerrado, true);
  assert.match(documento, /80mm auto/);
  assert.match(documento, /<h1>NUUCLEO<\/h1>/);
  assert.match(documento, /&lt;script&gt;externo&lt;\/script&gt;/);
  assert.doesNotMatch(documento, /<script>externo/);
  assert.match(documento, /Descuento/);
  assert.match(documento, /\$35\.00/);
});