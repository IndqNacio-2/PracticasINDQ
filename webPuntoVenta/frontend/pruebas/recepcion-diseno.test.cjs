const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const filename = path.resolve(__dirname, '../src/sections/webCobro/pages/RecepcionDetalle.jsx');
const exportsModule = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, allowJs: true },
}).outputText, { exports: exportsModule, require(name) {
  if (name === 'react/jsx-runtime') return require(name);
  if (name.endsWith('/MaterialIcon')) return { default: () => null };
  throw new Error(`Import inesperado: ${name}`);
} });
const Detalle = exportsModule.default;
const reserva = { id: 17, client: 'Ana Real', class: 'Yoga', fecha: '2026-11-12', time: '09:00', price: 180, status: 'pendiente', paymentStatus: 'pendiente' };
const props = { hoy: '2026-11-12', onCobrar() {}, onAsistencia() {}, onReagendar() {}, onCancelar() {} };
function nodos(n, lista = []) {
  if (!n || typeof n !== 'object') return lista;
  lista.push(n);
  React.Children.forEach(n.props?.children, c => nodos(c, lista));
  return lista;
}

test('detalle vacío solicita seleccionar reservación sin datos de demostración', () => {
  const html = renderToStaticMarkup(Detalle(props));
  assert.match(html, /Selecciona una reservación/);
  assert.doesNotMatch(html, /Ana Real|Cobrar reservación/);
});

test('detalle pendiente conserva el flujo de cobro y las acciones existentes', () => {
  let cobrada;
  let reagendada;
  const tree = Detalle({ ...props, reserva, onCobrar: id => { cobrada = id; }, onReagendar: r => { reagendada = r; } });
  const buttons = nodos(tree).filter(n => n.type === 'button');
  buttons.find(n => React.Children.toArray(n.props.children).includes('Cobrar reservación')).props.onClick();
  buttons.find(n => n.props.children === 'Reagendar').props.onClick();
  assert.equal(cobrada, 17);
  assert.equal(reagendada, reserva);
  assert.doesNotMatch(renderToStaticMarkup(tree), /Confirmar asistencia/);
});

test('detalle pagado ofrece asistencia; lista de espera no permite cobro ni asistencia', () => {
  const html = renderToStaticMarkup(Detalle({ ...props, reserva: { ...reserva, paymentStatus: 'pagado' } }));
  assert.match(html, /Confirmar asistencia/);
  assert.doesNotMatch(html, /Cobrar reservación/);
  const espera = renderToStaticMarkup(Detalle({ ...props, reserva: { ...reserva, capacityStatus: 'espera' } }));
  assert.match(espera, /Lista de espera/);
  assert.doesNotMatch(espera, /Cobrar reservación|Confirmar asistencia/);
});

test('acciones restringidas por el backend no se ejecutan desde el detalle', () => {
  let llamadas = 0;
  const tree = Detalle({ ...props, reserva: { ...reserva, puedeReagendar: false, puedeCancelar: false }, onReagendar() { llamadas++; }, onCancelar() { llamadas++; } });
  const acciones = nodos(tree).filter(n => n.type === 'button' && ['Reagendar', 'Cancelar reservación'].includes(n.props.children));
  assert.equal(acciones.length, 2);
  acciones.forEach(b => { assert.equal(b.props.disabled, true); b.props.onClick(); });
  assert.equal(llamadas, 0);
});

test('detalle muestra saldo real del paquete y no ofrece acciones en reservas finalizadas', () => {
  const html = renderToStaticMarkup(Detalle({ ...props, reserva: { ...reserva, membresiaCompraId: 12, status: 'cancelado' }, compra: { nombre: 'Yoga real', fechaFin: '2026-12-01', vigente: true, saldos: [{ claseId: null, disponibles: 4, total: 6 }] } }));
  assert.match(html, /Yoga real/);
  assert.match(html, /de 6/);
  assert.doesNotMatch(html, /Total a cobrar|Cobrar reservación|Confirmar asistencia|<button/);
});

const tablaModule = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/sections/webCobro/pages/RecepcionTabla.jsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, allowJs: true },
}).outputText, { exports: tablaModule, require(name) {
  if (name === 'react/jsx-runtime') return require(name);
  if (name.endsWith('/MaterialIcon')) return { default: () => null };
  throw new Error(`Import inesperado: ${name}`);
} });

test('tabla reproduce columnas del diseño con datos reales y permite seleccionar la reserva', () => {
  let id;
  const tree = tablaModule.default({ reservas: [{ ...reserva, clienteId: 2 }], clientes: [{ id: 2, fechaNacimiento: '2011-11-13', perfilSalud: { lesiones: ['Rodilla'] } }], seleccion: 17, hoy: props.hoy, onSeleccionar: valor => { id = valor; } });
  const html = renderToStaticMarkup(tree);
  for (const texto of ['Cliente', 'Código', 'Edad', 'Lesiones', 'Cobro', 'Estatus', 'Hora', 'Rodilla', 'Menor', 'Por cobrar']) assert.ok(html.includes(texto), texto);
  assert.match(html, /aria-selected="true"/);
  nodos(tree).find(n => n.type === 'button').props.onClick();
  assert.equal(id, 17);
});

test('edad respeta cumpleaños y no inventa datos ausentes o inválidos', () => {
  assert.equal(tablaModule.edadCliente({ fechaNacimiento: '2008-11-13' }, props.hoy), 17);
  assert.equal(tablaModule.edadCliente({ fechaNacimiento: '2008-11-12' }, props.hoy), 18);
  assert.equal(tablaModule.edadCliente({}, props.hoy), null);
  assert.equal(tablaModule.edadCliente({ fechaNacimiento: '2008-02-31' }, props.hoy), null);
});

test('recepción elimina KPI y conserva los flujos y la lista desplazable', () => {
  const dashboard = fs.readFileSync(path.resolve(__dirname, '../src/sections/webCobro/pages/dashboard.jsx'), 'utf8');
  const css = fs.readFileSync(path.resolve(__dirname, '../src/styles/recepcion-workspace.css'), 'utf8');
  assert.doesNotMatch(dashboard, /KpiCard|rx-grid-kpi/);
  assert.match(dashboard, /<RecepcionTabla/);
  for (const accion of ['onCobrar={handlePayment}', 'onAsistencia={handleConfirmAttendance}', 'onReagendar={openReagendar}', 'onCancelar={handleCancel}']) assert.ok(dashboard.includes(accion));
  assert.match(css, /overflow-y: auto/);
});