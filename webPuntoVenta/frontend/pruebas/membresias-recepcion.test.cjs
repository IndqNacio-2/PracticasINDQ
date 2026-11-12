const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const file = path.resolve(__dirname, '../src/sections/webCobro/pages/MembresiasRecepcion.jsx');
const source = fs.readFileSync(file, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText;

function cargar(fetchImpl) {
  const modulo = { exports: {} };
  vm.runInNewContext(compiled, { module: modulo, exports: modulo.exports,
    require: nombre => require(nombre), fetch: fetchImpl,
    localStorage: { getItem: () => 'sesion-prueba' },
  });
  return modulo.exports;
}
test('saldos muestran entradas disponibles, apartadas, consumidas y vigencia', () => {
  const { SaldosMembresias } = cargar();
  const html = renderToStaticMarkup(React.createElement(SaldosMembresias, {
    clases: [{ idClase: 'yoga', nombre: 'Yoga' }],
    compras: [{ id: 1, nombre: 'Plan personalizado', fechaInicio: '2099-01-01', fechaFin: '2099-01-31', vigente: true,
      saldos: [{ claseId: 'yoga', total: 6, disponibles: 3, apartadas: 2, consumidas: 1 }] }],
  }));
  assert.match(html, /Plan personalizado/);
  assert.match(html, /Yoga:/);
  assert.match(html, /3 disponibles de 6/);
  assert.match(html, /2 apartadas/);
  assert.match(html, /1 consumidas/);
  assert.match(html, /Vigente/);
});
test('saldo ilimitado y estado sin compras no inventan entradas', () => {
  const { SaldosMembresias } = cargar();
  assert.match(renderToStaticMarkup(React.createElement(SaldosMembresias, { compras: [] })), /Sin membresías compradas/);
  const html = renderToStaticMarkup(React.createElement(SaldosMembresias, { compras: [{ id: 1, nombre: 'Ilimitada', vigente: false,
    saldos: [{ claseId: null, total: null, disponibles: null, apartadas: 1, consumidas: 10 }] }] }));
  assert.match(html, /Ilimitadas/);
  assert.match(html, /Fuera de vigencia/);
});
test('API del componente envía token y propaga errores del servidor', async () => {
  let peticion;
  const modulo = cargar(async (url, options) => {
    peticion = { url, options };
    return { ok: false, json: async () => ({ error: 'No hay cobertura' }) };
  });
  await assert.rejects(modulo.membresiasRequest('/membresias/catalogo'), /No hay cobertura/);
  assert.equal(peticion.url, '/cobro/api/membresias/catalogo');
  assert.equal(peticion.options.headers.Authorization, 'Bearer sesion-prueba');
});

test('buscador incluye clientes con y sin compras, busca nombre sin acentos e ID', () => {
  const { filtrarClientesMembresias } = cargar();
  const clientes = [
    { id: 1, nombre: 'Juan Pérez', activo: true, tieneCompras: true },
    { id: 2, nombre: 'María López', activo: true, tieneCompras: false },
    { id: 3, nombre: 'Cliente inactivo', activo: false },
  ];
  assert.equal(filtrarClientesMembresias(clientes, '').length, 2);
  assert.equal(filtrarClientesMembresias(clientes, 'perez')[0].id, 1);
  assert.equal(filtrarClientesMembresias(clientes, 'MARIA')[0].id, 2);
  assert.equal(filtrarClientesMembresias(clientes, '#2')[0].id, 2);
  assert.equal(filtrarClientesMembresias(clientes, 'inactivo').length, 0);
  assert.equal(filtrarClientesMembresias(clientes, 'desconocido').length, 0);
});

test('venta usa modal compartido, buscador y pie de acciones asociado al formulario', () => {
  const { default: MembresiasRecepcion } = cargar();
  const html = renderToStaticMarkup(React.createElement(MembresiasRecepcion, {
    clientes: [], clases: [], onClose() {}, onVenta() {}, onTicket() {},
  }));
  for (const texto of ['role="dialog"', 'aria-modal="true"', 'rx-modal-header', 'rx-modal-body rx-form-stack', 'rx-modal-footer',
    'role="combobox"', 'Escribe ID o nombre...', 'con o sin membresías compradas', 'form="form-venta-membresia"']) {
    assert.ok(html.includes(texto), texto);
  }
  assert.doesNotMatch(html, /Selecciona un cliente<\/option>/);
  assert.match(html, /Continuar al cobro/);
  assert.doesNotMatch(html, /Efectivo recibido/);
});

test('cobro de membresía reutiliza botones y paneles de cobro para los tres métodos', () => {
  const { PagoMembresia } = cargar();
  const props = { cliente: { id: 7, nombre: 'Ricardo Morales' }, membresia: { nombre: 'Yoga mensual' },
    opcion: { costo: 200, entradas: 8, duracion: 1, unidadDuracion: 'meses' }, fechaInicio: '2026-11-05',
    metodoPago: '', efectivo: '', referencia: '', ocupado: false, setMetodoPago() {}, setEfectivo() {}, setReferencia() {} };
  const render = cambios => renderToStaticMarkup(React.createElement(PagoMembresia, { ...props, ...cambios }));
  const inicial = render({});
  for (const texto of ['Ricardo Morales', 'Yoga mensual', 'rx-payment-methods', 'Efectivo', 'Tarjeta', 'Transferencia']) assert.ok(inicial.includes(texto), texto);
  assert.doesNotMatch(inicial, /<select/);
  assert.match(render({ metodoPago: 'efectivo', efectivo: '100' }), /El efectivo es insuficiente/);
  const efectivo = render({ metodoPago: 'efectivo', efectivo: '250' });
  assert.match(efectivo, /Cambio a devolver/);
  assert.match(efectivo, /\$50\.00/);
  assert.match(render({ metodoPago: 'tarjeta' }), /terminal física/);
  assert.match(render({ metodoPago: 'transferencia' }), /Referencia de transferencia/);
});

test('confirmación de cobro exige método y efectivo suficiente, incluso para total cero', () => {
  const { puedeCobrarMembresia } = cargar();
  for (const efectivo of ['', '100', 'NaN', 'Infinity']) assert.equal(puedeCobrarMembresia('efectivo', efectivo, 200), false);
  assert.equal(puedeCobrarMembresia('', '', 200), false);
  assert.equal(puedeCobrarMembresia('efectivo', '', 0), false);
  assert.equal(puedeCobrarMembresia('efectivo', '0', 0), true);
  assert.equal(puedeCobrarMembresia('efectivo', '200', 200), true);
  assert.equal(puedeCobrarMembresia('tarjeta', '', 200), true);
  assert.equal(puedeCobrarMembresia('transferencia', '', 200), true);
});