const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function load(relative, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require, TextEncoder, ...globals });
  return exports;
}
const product = { id: 1, code: '00123', name: 'Agua & limón <500>', category: 'Bebidas', price: 20.5, stock: 8, minimumStock: 2, status: 'active' };
const modulePath = '../src/components/inventory/exportInventory.ts';

function unzip(workbook) {
  const buffer = Buffer.from(workbook); const files = {}; let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(buffer.readUInt16LE(offset + 8), 0);
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLength);
    const start = offset + 30 + nameLength + extraLength;
    const data = buffer.subarray(start, start + size);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    assert.equal((crc ^ 0xffffffff) >>> 0, buffer.readUInt32LE(offset + 14));
    files[name] = data.toString('utf8'); offset = start + size;
  }
  const centralStart = offset;
  for (const name of Object.keys(files)) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
    const nameLength = buffer.readUInt16LE(offset + 28);
    assert.equal(buffer.toString('utf8', offset + 46, offset + 46 + nameLength), name);
    assert.equal(buffer.readUInt32LE(buffer.readUInt32LE(offset + 42)), 0x04034b50);
    offset += 46 + nameLength;
  }
  assert.equal(buffer.readUInt32LE(offset), 0x06054b50);
  assert.equal(buffer.readUInt16LE(offset + 10), Object.keys(files).length);
  assert.equal(buffer.readUInt32LE(offset + 12), offset - centralStart);
  assert.equal(buffer.readUInt32LE(offset + 16), centralStart);
  assert.equal(buffer.length, offset + 22);
  return files;
}
const sheet = workbook => unzip(workbook)['xl/worksheets/sheet1.xml'];

test('Excel conserva tipos, ceros del código y datos reales; deja dos columnas vacías sin mutar inventario', () => {
  const { buildInventoryWorkbook } = load(modulePath);
  const products = [Object.freeze({ ...product, name: 'Zumo', status: 'inactive' }), Object.freeze(product)];
  const workbook = buildInventoryWorkbook(Object.freeze(products));
  const files = unzip(workbook);
  assert.equal(Object.keys(files).length, 6);
  assert.match(files['[Content_Types].xml'], /spreadsheetml.sheet.main\+xml/);
  assert.match(files['xl/_rels/workbook.xml.rels'], /worksheets\/sheet1.xml/);
  assert.match(files['xl/workbook.xml'], /sheet name="Inventario"/);
  const xml = files['xl/worksheets/sheet1.xml'];
  assert.match(xml, /dimension ref="A1:I3"/);
  assert.match(xml, /t="inlineStr"><is><t xml:space="preserve">00123</);
  assert.match(xml, /Agua &amp; limón &lt;500&gt;/);
  assert.match(xml, /<v>20.5<\/v>/);
  assert.match(xml, /<v>8<\/v>/);
  assert.match(xml, /Inventario físico/);
  assert.match(xml, /Observaciones/);
  assert.equal((xml.match(/<c s="3"\/>/g) || []).length, 4);
  assert.ok(xml.indexOf('Agua &amp;') < xml.indexOf('Zumo'));
  assert.match(xml, /Inactivo/);
  assert.equal(products[0].name, 'Zumo');
});

test('Excel exporta texto sin fórmulas, limpia controles XML y rechaza números inválidos', () => {
  const { buildInventoryWorkbook } = load(modulePath);
  const xml = sheet(buildInventoryWorkbook([{ ...product, name: '=1+1\u0000', code: '@SUM(A1)', stock: 0 }]));
  assert.match(xml, /t="inlineStr"><is><t xml:space="preserve">=1\+1</);
  assert.doesNotMatch(xml, /<f[ >]|\u0000/);
  assert.match(xml, /Agotado/);
  assert.match(sheet(buildInventoryWorkbook([{ ...product, stock: 1 }])), /Stock bajo/);
  assert.throws(() => buildInventoryWorkbook([{ ...product, stock: NaN }]), /número inválido/);
  assert.match(sheet(buildInventoryWorkbook([])), /dimension ref="A1:I1"/);
});

test('descarga XLSX real con fecha local y libera el enlace y su URL después de iniciarla', async () => {
  let blob; let clicked = false; let removed = false; let cleanup; let revoked;
  const link = { click() { clicked = true; }, remove() { removed = true; } };
  const { exportInventory } = load(modulePath, {
    Blob,
    URL: { createObjectURL(value) { blob = value; return 'blob:inventario'; }, revokeObjectURL(value) { revoked = value; } },
    document: { createElement: () => link, body: { appendChild(value) { assert.equal(value, link); } } },
    setTimeout(fn) { cleanup = fn; },
  });
  exportInventory([product], new Date(2026, 10, 13));
  assert.equal(link.download, 'inventario-fisico-2026-11-13.xlsx');
  assert.equal(link.href, 'blob:inventario');
  assert.equal(clicked, true); assert.equal(removed, true);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const data = await blob.arrayBuffer();
  assert.equal(Buffer.from(data).subarray(0, 2).toString(), 'PK');
  assert.match(sheet(data), /Inventario físico/);
  assert.equal(revoked, undefined); cleanup(); assert.equal(revoked, 'blob:inventario');
});

function mount(products, fail = false) {
  const states = []; let cursor = 0; const calls = []; const toasts = [];
  const page = load('../src/components/InventoryPage.tsx', { require(name) {
    if (name === 'react') return {
      useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], v => { states[i] = v; }]; },
      useMemo: fn => fn(), useRef: () => ({ current: null }),
    };
    if (name === 'react/jsx-runtime') return require(name);
    if (name === '../data') return { CATEGORIES: ['Bebidas'] };
    if (name === './inventory/exportInventory') return { exportInventory(items) { if (fail) throw Error('fallo'); calls.push(items); } };
    return { default: () => null };
  } });
  return { states, calls, toasts, render() { cursor = 0; return page.default({ products, addToast: (...args) => toasts.push(args) }); } };
}
function nodes(node, list = []) {
  if (!node || typeof node !== 'object') return list;
  list.push(node); React.Children.forEach(node.props?.children, child => nodes(child, list)); return list;
}
const exportButton = tree => nodes(tree).find(n => n.type === 'button' && React.Children.toArray(n.props.children).includes('Exportar a Excel'));

test('botón junto a agregar exporta catálogo completo aun con filtros y conserva el alta', () => {
  const products = [product]; const app = mount(products); app.render(); app.states[0] = 'sin coincidencias';
  const tree = app.render(); const button = exportButton(tree);
  assert.equal(button.props.disabled, false); button.props.onClick();
  assert.equal(app.calls[0], products); assert.equal(app.toasts[0][1], 'success');
  const group = nodes(tree).find(n => n.props?.className === 'rx-inventory-header-actions');
  const buttons = React.Children.toArray(group.props.children);
  assert.equal(buttons.length, 2); assert.equal(buttons[1].props.className, 'rx-btn rx-btn--accent');
  buttons[1].props.onClick(); assert.equal(app.states[6], 'add');
});

test('exportación deshabilitada sin productos y error de descarga sin falso éxito', () => {
  assert.equal(exportButton(mount([]).render()).props.disabled, true);
  const app = mount([product], true); exportButton(app.render()).props.onClick();
  assert.equal(app.calls.length, 0); assert.equal(app.toasts.length, 1); assert.equal(app.toasts[0][1], 'error');
});