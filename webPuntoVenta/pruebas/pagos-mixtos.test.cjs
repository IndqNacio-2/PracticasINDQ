const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const root = path.resolve(__dirname, '..');

function cargar(archivo, mocks = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, archivo), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module, exports: module.exports, console, require(nombre) {
    if (nombre in mocks) return mocks[nombre];
    throw Error(`Importación no simulada: ${nombre}`);
  } });
  return module.exports;
}

const { validateSaleInput } = cargar('backend/src/sales/sale.validation.ts');
const entrada = (payments, extras = {}) => ({ items: [{ productId: 1, quantity: 1 }],
  paymentMethod: 'mixto', payments, cashReceived: 30, ...extras });
const partes = [{ method: 'efectivo', amount: 20 }, { method: 'tarjeta', amount: 20 }];

function ventaSimulada(hasPayments = true) {
  const calls = [];
  let inserted;
  const client = { release() {}, async query(sql, args = []) {
    calls.push(sql);
    if (/information_schema.columns/.test(sql)) return { rows: [{ hasPayments }] };
    if (/SELECT id, name, price/.test(sql)) return { rows: [{ id: 1, name: 'Producto', price: 40, stock: 5, status: 'active' }] };
    if (/next_id/.test(sql)) return { rows: [{ next_id: 1 }] };
    if (/INSERT INTO webpontoventa.sales/.test(sql)) { inserted = args; return { rows: [{ id: 1 }] }; }
    if (/WHERE s.folio/.test(sql)) return { rows: [{ id: 1, payments: hasPayments ? JSON.parse(inserted[9]) : null, change: inserted[6] }] };
    return { rows: [], rowCount: 1 };
  } };
  const repo = cargar('backend/src/sales/sale.repository.ts', { '../config/postgres.js': { postgresPool: { connect: async () => client } } });
  return { repo, calls, inserted: () => inserted };
}

test('sin columna payments rechaza mixto sin insertar ni alterar existencias', async () => {
  const p = ventaSimulada(false);
  const result = await p.repo.insertSale(validateSaleInput(entrada(partes)).input, 'vendedor');
  assert.equal(result.outcome, 'payment-schema-required');
  assert.match(result.message, /pagos-mixtos.sql/);
  assert.ok(p.calls.includes('ROLLBACK'));
  assert.equal(p.inserted(), undefined);
  assert.equal(p.calls.some(sql => /UPDATE|INSERT INTO/.test(sql)), false);
});

test('sin columna payments permite los tres métodos individuales sin referenciarla al insertar', async () => {
  for (const paymentMethod of ['efectivo', 'tarjeta', 'transferencia']) {
    const p = ventaSimulada(false);
    const input = validateSaleInput({ items: [{ productId: 1, quantity: 1 }], paymentMethod, cashReceived: 50 }).input;
    assert.equal((await p.repo.insertSale(input, 'vendedor')).outcome, 'created');
    assert.equal(p.inserted().length, 9);
    assert.doesNotMatch(p.calls.find(sql => /INSERT INTO webpontoventa.sales/.test(sql)), /payments/);
    assert.ok(p.calls.includes('COMMIT'));
  }
});

test('listado no referencia directamente la columna payments y mantiene filtro del vendedor', async () => {
  let consulta;
  const repo = cargar('backend/src/sales/sale.repository.ts', { '../config/postgres.js': { postgresPool: {
    async query(sql, args) { consulta = { sql, args }; return { rows: [{ id: 1, payments: null }] }; },
  } } });
  assert.equal((await repo.listSales('vendedor'))[0].id, 1);
  assert.doesNotMatch(consulta.sql, /s\.payments/);
  assert.match(consulta.sql, /to_jsonb\(s\)->'payments'/);
  assert.equal(consulta.args[0], 'vendedor');
  assert.match(consulta.sql, /s\.seller_id = \$1/);
});

test('valida dos o tres métodos; rechaza repetidos, negativos, decimales extra y desconocidos', () => {
  assert.ok(validateSaleInput(entrada(partes)).input);
  assert.ok(validateSaleInput(entrada([{ method: 'tarjeta', amount: 10 }, { method: 'transferencia', amount: 20 }, { method: 'efectivo', amount: 10 }])).input);
  for (const payments of [[partes[0]], [partes[0], partes[0]], [{ method: 'otro', amount: 20 }, partes[1]],
    [{ method: 'efectivo', amount: -1 }, partes[1]], [{ method: 'efectivo', amount: 1.001 }, partes[1]]]) {
    assert.equal(validateSaleInput(entrada(payments)).input, null);
  }
});

test('guarda 20 efectivo + 20 tarjeta y calcula 10 de cambio al recibir 30', async () => {
  const p = ventaSimulada();
  const result = await p.repo.insertSale(validateSaleInput(entrada(partes)).input, 'vendedor');
  assert.equal(result.outcome, 'created');
  assert.equal(p.inserted()[6], 10);
  assert.equal(JSON.parse(p.inserted()[9])[0].amount, 20);
  assert.ok(p.calls.includes('COMMIT'));
});

test('rechaza suma incompleta, excedente y efectivo insuficiente antes de insertar', async () => {
  for (const body of [entrada([{ method: 'efectivo', amount: 10 }, partes[1]]),
    entrada([{ method: 'efectivo', amount: 30 }, partes[1]]), entrada(partes, { cashReceived: 1 }),
    { items: [{ productId: 1, quantity: 1 }], paymentMethod: 'efectivo', cashReceived: 1 }]) {
    const p = ventaSimulada();
    assert.equal((await p.repo.insertSale(validateSaleInput(body).input, 'vendedor')).outcome, 'invalid-payment');
    assert.ok(p.calls.includes('ROLLBACK'));
    assert.equal(p.inserted(), undefined);
  }
});

test('conserva tarjeta, transferencia y efectivo de un solo método', async () => {
  for (const paymentMethod of ['efectivo', 'tarjeta', 'transferencia']) {
    const p = ventaSimulada();
    const input = validateSaleInput({ items: [{ productId: 1, quantity: 1 }], paymentMethod, cashReceived: 50 }).input;
    assert.equal((await p.repo.insertSale(input, 'vendedor')).outcome, 'created');
    assert.equal(JSON.parse(p.inserted()[9])[0].amount, 40);
    assert.equal(p.inserted()[5], paymentMethod === 'efectivo' ? 50 : null);
  }
});

for (const legacy of [false, true]) test(`corte de caja ${legacy ? 'sin columna payments' : 'con pago mixto'} calcula importes correctos`, async () => {
  let inserted;
  const client = { release() {}, async query(sql, args = []) {
    if (/SELECT id, total/.test(sql)) {
      assert.match(sql, /to_jsonb\(s\)->'payments'/);
      return { rows: [{ id: 1, total: 40, payment_method: legacy ? 'efectivo' : 'mixto', payments: legacy ? null : partes }] };
    }
    if (/next_id/.test(sql)) return { rows: [{ next_id: 1 }] };
    if (/INSERT INTO/.test(sql)) { inserted = args; return { rows: [{ id: 1 }] }; }
    if (/UPDATE webpontoventa.sales/.test(sql)) return { rows: [], rowCount: 1 };
    return { rows: [{ id: 1 }] };
  } };
  const repo = cargar('backend/src/cash-closings/cash-closing.repository.ts', { '../config/postgres.js': { postgresPool: { connect: async () => client } } });
  await repo.insertCashClosing({ initialFund: 100, countedCash: legacy ? 140 : 120, registeredBy: 'vendedor' }, 'vendedor', [1]);
  assert.equal(inserted[2], 40);
  assert.equal(inserted[3], legacy ? 40 : 20);
  assert.equal(inserted[4], legacy ? 0 : 20);
  assert.equal(inserted[5], 0);
  assert.equal(inserted[7], legacy ? 140 : 120);
  assert.equal(inserted[9], 0);
});

test('resumen frontend conserva ventas históricas y separa pagos mixtos', () => {
  const { paymentAmount } = cargar('frontend/src/services/paymentAmounts.ts');
  assert.equal(paymentAmount({ total: 40, paymentMethod: 'mixto', payments: partes }, 'efectivo'), 20);
  assert.equal(paymentAmount({ total: 40, paymentMethod: 'tarjeta' }, 'tarjeta'), 40);
  assert.equal(paymentAmount({ total: 40, paymentMethod: 'tarjeta' }, 'efectivo'), 0);
});

test('modal muestra opción Mixto y ticket incluye desglose y cambio', () => {
  const React = require('../frontend/node_modules/react');
  const { renderToStaticMarkup } = require('../frontend/node_modules/react-dom/server');
  const mocks = { react: React, 'react/jsx-runtime': require('../frontend/node_modules/react/jsx-runtime'), './MaterialIcon': { default: () => null } };
  const Modal = cargar('frontend/src/components/PaymentModal.tsx', mocks).default;
  assert.match(renderToStaticMarkup(React.createElement(Modal, { total: 40, onConfirm() {}, onClose() {} })), /Mixto/);
  const Ticket = cargar('frontend/src/components/TicketModal.tsx', mocks).default;
  const html = renderToStaticMarkup(React.createElement(Ticket, { sale: { total: 40, subtotal: 40, discount: 0, items: [],
    folio: 'V-1', date: '01/01/2026', time: '12:00', paymentMethod: 'mixto', payments: partes, cashReceived: 30, change: 10 }, onClose() {}, onNewSale() {} }));
  assert.match(html, /Mixto/);
  assert.match(html, /Efectivo/);
  assert.match(html, /Tarjeta/);
  assert.match(html, /Cambio/);
});

// Ejecuta eventos del componente sin navegador ni conexiones a servicios.
function modalPorPasos() {
  const React = require('../frontend/node_modules/react');
  const states = [];
  let cursor = 0;
  const enviados = [];
  const Modal = cargar('frontend/src/components/PaymentModal.tsx', {
    react: { ...React,
      useState(initial) {
        const index = cursor++;
        if (!(index in states)) states[index] = initial;
        return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
      },
      useRef(initial) { const index = cursor++; return states[index] ??= { current: initial }; },
    },
    'react/jsx-runtime': require('../frontend/node_modules/react/jsx-runtime'), './MaterialIcon': { default: () => null },
  }).default;
  function nodes(node, result = []) {
    if (Array.isArray(node)) { node.forEach(child => nodes(child, result)); return result; }
    if (!node || typeof node !== 'object' || !node.props) return result;
    result.push(node);
    nodes(node.props.children, result);
    return result;
  }
  function text(node) {
    if (Array.isArray(node)) return node.map(text).join('');
    if (node && typeof node === 'object') return text(node.props?.children);
    return node == null || typeof node === 'boolean' ? '' : String(node);
  }
  const render = () => { cursor = 0; return nodes(Modal({ total: 40, onClose() {}, onConfirm(data) { enviados.push(data); } })); };
  const button = label => render().find(node => node.type === 'button' && text(node).includes(label));
  const input = label => render().find(node => node.type === 'label' && text(node).includes(label)).props.children
    .find(node => node?.type === 'input');
  return { render, button, input, enviados, text };
}

for (const method of ['Tarjeta', 'Transferencia']) test(`modal por pasos: efectivo y después ${method}`, async () => {
  const h = modalPorPasos();
  h.button('Mixto').props.onClick();
  assert.equal(h.button('Confirmar pago'), undefined);
  assert.equal(h.button('Continuar con el restante').props.disabled, true);
  h.input('Importe a pagar en efectivo').props.onChange({ target: { value: '20' } });
  assert.equal(h.input('Efectivo recibido').props.value, '20');
  h.input('Efectivo recibido').props.onChange({ target: { value: '30' } });
  h.button('Continuar con el restante').props.onClick();
  assert.equal(h.button('Confirmar pago'), undefined);
  h.button(method).props.onClick();
  assert.ok(h.render().some(node => node.props.className === 'rx-payment-information-value' && h.text(node) === '$20.00'));
  if (method === 'Transferencia') h.input('Referencia de transferencia').props.onChange({ target: { value: ' REF-1 ' } });
  await h.button('Confirmar pago').props.onClick();
  assert.equal(h.enviados.length, 1);
  assert.equal(h.enviados[0].method, 'mixto');
  assert.equal(h.enviados[0].payments[0].amount, 20);
  assert.equal(h.enviados[0].payments[1].amount, 20);
  assert.equal(h.enviados[0].payments[1].method, method.toLowerCase());
  assert.equal(h.enviados[0].cashReceived, 30);
  assert.equal(h.enviados[0].transferRef, method === 'Transferencia' ? 'REF-1' : undefined);
});

test('modal por pasos rechaza efectivo inválido y recalcula al volver a editar', () => {
  const h = modalPorPasos();
  h.button('Mixto').props.onClick();
  for (const value of ['0', '-1', '40', '50', '1.001']) {
    h.input('Importe a pagar en efectivo').props.onChange({ target: { value } });
    assert.equal(h.button('Continuar con el restante').props.disabled, true);
  }
  h.input('Importe a pagar en efectivo').props.onChange({ target: { value: '20' } });
  h.input('Efectivo recibido').props.onChange({ target: { value: '10' } });
  assert.equal(h.button('Continuar con el restante').props.disabled, true);
  h.input('Efectivo recibido').props.onChange({ target: { value: '20' } });
  h.button('Continuar con el restante').props.onClick();
  h.button('Transferencia').props.onClick();
  h.input('Referencia de transferencia').props.onChange({ target: { value: 'ANTERIOR' } });
  h.button('Editar efectivo').props.onClick();
  h.input('Importe a pagar en efectivo').props.onChange({ target: { value: '15.25' } });
  h.button('Continuar con el restante').props.onClick();
  assert.equal(h.button('Confirmar pago'), undefined);
  h.button('Transferencia').props.onClick();
  assert.equal(h.input('Referencia de transferencia').props.value, '');
  assert.ok(h.render().some(node => node.props.className === 'rx-payment-information-value' && h.text(node) === '$24.75'));
});