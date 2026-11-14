const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function cargar(nombre, window = {}) {
  const filename = path.resolve(__dirname, '../src/components', nombre);
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, window, require(nombre) {
    if (nombre === 'react/jsx-runtime') return require(nombre);
    if (nombre === './MaterialIcon') return { default: () => null };
    throw new Error(`Import inesperado: ${nombre}`);
  } }, { filename });
  return exports.default;
}

const venta = {
  folio: 'V-PRUEBA', date: '13/11/2026', time: '10:00',
  items: [{ name: 'Producto', qty: 1, unitPrice: 50, subtotal: 50 }],
  subtotal: 50, discount: 0, total: 50,
  paymentMethod: 'tarjeta', cashReceived: null, change: null, transferRef: null,
};
function nodos(nodo, lista = []) {
  if (!nodo || typeof nodo !== 'object') return lista;
  lista.push(nodo);
  React.Children.forEach(nodo.props?.children, hijo => nodos(hijo, lista));
  return lista;
}

for (const metodo of ['tarjeta', 'transferencia', 'efectivo']) {
  for (const valores of [{ cashReceived: null, change: null }, {}, { cashReceived: 100, change: 50 }]) {
    test(`ticket visible e impresión: ${metodo}, campos ${JSON.stringify(valores)}`, () => {
      let impreso = ''; let cierres = 0;
      const Ticket = cargar('TicketModal.tsx', { open() { return {
        document: { write(html) { impreso = html; }, close() { cierres++; } },
      }; } });
      const sale = { ...venta, cashReceived: undefined, change: undefined, ...valores, paymentMethod: metodo };
      const arbol = Ticket({ sale, onClose() {}, onNewSale() {} });
      const html = renderToStaticMarkup(arbol);
      const etiqueta = { tarjeta: 'Tarjeta', efectivo: 'Efectivo', transferencia: 'Transferencia' }[metodo];
      assert.match(html, new RegExp(etiqueta));
      nodos(arbol).find(n => n.type === 'button' && React.Children.toArray(n.props.children).includes('Imprimir')).props.onClick();
      assert.match(impreso, new RegExp(`Método:</strong> ${etiqueta}`));
      assert.equal(cierres, 1);
      assert.match(impreso, /window\.print\(\)/);
      if (metodo === 'efectivo' && valores.cashReceived != null) {
        assert.match(html, /Recibido:/); assert.match(html, /Cambio:/);
        assert.match(impreso, /Recibido:/); assert.match(impreso, /Cambio:/);
      } else {
        assert.doesNotMatch(html, /Recibido:|Cambio:/);
        assert.doesNotMatch(impreso, /Recibido:|Cambio:/);
      }
    });
  }
}

test('confirmación de venta con tarjeta admite los valores nulos del backend', () => {
  const Confirmacion = cargar('SaleSuccessModal.tsx');
  const html = renderToStaticMarkup(Confirmacion({ sale: venta, onNewSale() {}, onShowTicket() {} }));
  assert.match(html, /Tarjeta/);
  assert.doesNotMatch(html, /Recibido|Cambio/);
});