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

test('detalle abre y cierra sin perder la reserva ni ejecutar acciones', () => {
  let colapsado = false;
  const render = reservaActual => Detalle({ ...props, reserva: reservaActual, colapsado, onAlternar() { colapsado = !colapsado; } });
  for (const actual of [undefined, reserva]) {
    let tree = render(actual);
    let boton = nodos(tree).find(n => n.props?.['aria-label'] === 'Cerrar detalle de reservación');
    assert.equal(boton.props['aria-expanded'], true);
    boton.props.onClick();
    tree = render(actual);
    assert.match(tree.props.className, /rx-reception-detail--collapsed/);
    assert.doesNotMatch(renderToStaticMarkup(tree), /Selecciona una reservación|Cobrar reservación|Ana Real/);
    boton = nodos(tree).find(n => n.props?.['aria-label'] === 'Abrir detalle de reservación');
    assert.equal(boton.props['aria-expanded'], false);
    boton.props.onClick();
    tree = render(actual);
    assert.match(renderToStaticMarkup(tree), actual ? /Ana Real/ : /Selecciona una reservación/);
  }
  const dashboard = fs.readFileSync(path.resolve(__dirname, '../src/sections/webCobro/pages/dashboard.jsx'), 'utf8');
  assert.match(dashboard, /colapsado=\{detalleColapsado\} onAlternar=\{\(\) => setDetalleColapsado\(valor => !valor\)\}/);
  assert.match(dashboard, /rx-reception-workspace--detail-collapsed/);
});

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

test('detalle muestra lesiones actuales y conserva compatibilidad sin revivir lesiones eliminadas', () => {
  for (const [cliente, esperado, resaltado] of [
    [{ lesiones: ['Rodilla', 'Tobillo'], telefono: '6682433048' }, 'Rodilla, Tobillo', true],
    [{ lesiones: [], perfilSalud: { lesiones: ['Lesión eliminada'] } }, 'Ninguna', false],
    [{ lesiones: [] }, 'Ninguna', false],
    [{ perfilSalud: { lesiones: ['Espalda'] } }, 'Espalda', true],
    [{ telefono: '6682433048' }, 'Sin dato', false],
    [undefined, 'Sin dato', false],
  ]) {
    const tree = Detalle({ ...props, reserva, cliente });
    const fila = nodos(tree).find(n => n.type === 'div' && React.Children.toArray(n.props.children).some(hijo => hijo.type === 'dt' && hijo.props.children === 'Lesiones'));
    const valor = nodos(fila).find(n => n.type === 'dd');
    assert.equal(valor.props.children, esperado);
    assert.equal(valor.props.className === 'rx-value--danger', resaltado);
    assert.ok(renderToStaticMarkup(tree).includes(esperado));
  }
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

test('seleccionar una reservación abre el detalle incluso al repetir la misma selección', () => {
  const dashboard = fs.readFileSync(path.resolve(__dirname, '../src/sections/webCobro/pages/dashboard.jsx'), 'utf8');
  const handler = dashboard.match(/onSeleccionar=\{(id => \{[^}]+\})\}/);
  assert.ok(handler, 'La tabla debe seleccionar la reserva y abrir su detalle');
  let seleccion = null;
  let colapsado = true;
  const seleccionar = vm.runInNewContext(`(${handler[1]})`, {
    setReservaVistaId(id) { seleccion = id; },
    setDetalleColapsado(valor) { colapsado = valor; },
  });
  const tree = tablaModule.default({ reservas: [reserva], clientes: [], hoy: props.hoy, onSeleccionar: seleccionar });
  nodos(tree).find(n => n.type === 'tr' && n.props.onClick).props.onClick();
  assert.equal(seleccion, reserva.id);
  assert.equal(colapsado, false);
  colapsado = true;
  nodos(tree).find(n => n.type === 'button').props.onClick();
  assert.equal(seleccion, reserva.id);
  assert.equal(colapsado, false);
  seleccionar(18);
  assert.equal(seleccion, 18);
  assert.equal(colapsado, false);
});

test('tabla reproduce columnas del diseño con datos reales y permite seleccionar la reserva', () => {
  let id;
  const tree = tablaModule.default({ reservas: [{ ...reserva, clienteId: 2 }], clientes: [{ id: 2, fechaNacimiento: '2011-11-13', perfilSalud: { lesiones: ['Rodilla'] } }], seleccion: 17, hoy: props.hoy, onSeleccionar: valor => { id = valor; } });
  const html = renderToStaticMarkup(tree);
  for (const texto of ['Cliente', 'Código', 'Edad', 'Lesiones', 'Cobro', 'Estatus', 'Hora', 'Rodilla', 'Menor', 'Por cobrar']) assert.ok(html.includes(texto), texto);
  assert.match(html, /aria-selected="true"/);
  nodos(tree).find(n => n.type === 'button').props.onClick();
  assert.equal(id, 17);
});

test('tabla muestra código del checador sin confundirlo con la reservación', () => {
  const tree = tablaModule.default({ reservas: [
    { ...reserva, clienteId: 2, codigo: 'RES-17' },
    { ...reserva, id: 18, clienteId: 3, codigo: 'RES-18' },
    { ...reserva, id: 19, clienteId: null, type: 'visitante', codigo: 'RES-19' },
    { ...reserva, id: 20, clienteId: 99, codigo: 'RES-20' },
    { ...reserva, id: 21, clienteId: 2, type: 'visitante', codigo: 'RES-21' },
  ], clientes: [{ id: 3, nombre: reserva.client }, { id: 2, nombre: reserva.client }], hoy: props.hoy, onSeleccionar() {} });
  const filas = nodos(tree).filter(n => n.type === 'tr' && n.props.onClick);
  const primera = fila => nodos(fila).find(n => n.type === 'td').props.children.props.children;
  assert.deepEqual(filas.map(primera), ['CLI-2', 'CLI-3', '—', '—', '—']);
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Código Usuario/);
  assert.match(html, /RES-17/);
  assert.equal(nodos(filas[0]).filter(n => n.type === 'td').length, 8);
});

test('tabla muestra lesiones actuales por ID sin mezclar clientes con el mismo nombre', () => {
  const tree = tablaModule.default({
    reservas: [{ ...reserva, clienteId: '2' }, { ...reserva, id: 18, clienteId: 3 }],
    clientes: [
      { id: 3, nombre: reserva.client, lesiones: ['Hombro'] },
      { id: 2, nombre: reserva.client, lesiones: ['Rodilla', 'Tobillo'] },
    ], hoy: props.hoy, onSeleccionar() {},
  });
  const celdas = nodos(tree).filter(n => n.type === 'td' && n.props.className?.includes('rx-reception-injuries'));
  assert.equal(celdas[0].props.children, 'Rodilla, Tobillo');
  assert.equal(celdas[1].props.children, 'Hombro');
  assert.match(celdas[0].props.className, /rx-value--danger/);
});

test('tabla distingue lesiones eliminadas de datos ausentes y conserva el formato histórico', () => {
  for (const [cliente, esperado] of [
    [{ id: 2, lesiones: [], perfilSalud: { lesiones: ['Lesión eliminada'] } }, 'Ninguna'],
    [{ id: 2, lesiones: [] }, 'Ninguna'],
    [{ id: 2 }, 'Sin dato'],
    [{ id: 2, perfilSalud: { lesiones: ['Espalda'] } }, 'Espalda'],
  ]) {
    const tree = tablaModule.default({ reservas: [{ ...reserva, clienteId: 2 }], clientes: [cliente], hoy: props.hoy, onSeleccionar() {} });
    const celda = nodos(tree).find(n => n.type === 'td' && n.props.className?.includes('rx-reception-injuries'));
    assert.equal(celda.props.children, esperado);
    assert.equal(celda.props.className.includes('rx-value--danger'), esperado === 'Espalda');
  }
});

test('tabla no atribuye lesiones a visitantes ni a reservas sin cliente registrado', () => {
  for (const clienteId of [null, undefined, 99]) {
    const tree = tablaModule.default({ reservas: [{ ...reserva, clienteId }],
      clientes: [{ lesiones: ['Ajena'] }, { id: 2, nombre: reserva.client, lesiones: ['Ajena'] }], hoy: props.hoy, onSeleccionar() {} });
    const celda = nodos(tree).find(n => n.type === 'td' && n.props.className?.includes('rx-reception-injuries'));
    assert.equal(celda.props.children, 'Sin dato');
  }
});

test('edad respeta cumpleaños y no inventa datos ausentes o inválidos', () => {
  assert.equal(tablaModule.edadCliente({ fechaNacimiento: '2008-11-13' }, props.hoy), 17);
  assert.equal(tablaModule.edadCliente({ fechaNacimiento: '2008-11-12' }, props.hoy), 18);
  assert.equal(tablaModule.edadCliente({}, props.hoy), null);
  assert.equal(tablaModule.edadCliente({ fechaNacimiento: '2008-02-31' }, props.hoy), null);
});

test('recepción integra los KPI de Carlos y conserva los flujos y la lista desplazable', () => {
  const dashboard = fs.readFileSync(path.resolve(__dirname, '../src/sections/webCobro/pages/dashboard.jsx'), 'utf8');
  const css = fs.readFileSync(path.resolve(__dirname, '../src/styles/recepcion-workspace.css'), 'utf8');
  assert.doesNotMatch(dashboard, /KpiCard|rx-grid-kpi/);
  assert.match(dashboard, /aria-label="Resumen de recepción"/);
  const inicioPanel = dashboard.indexOf('<section className="rx-reception-schedule"');
  const inicioKpis = dashboard.indexOf('<section className="rx-reception-kpis"');
  const selectorFecha = dashboard.indexOf('Fecha de clases', inicioPanel);
  assert.ok(inicioPanel < inicioKpis && inicioKpis < selectorFecha, 'Los KPI deben estar en el panel izquierdo antes del selector de fecha');
  assert.equal(dashboard.match(/className="rx-reception-kpis"/g).length, 1);
  assert.match(dashboard, /Clases programadas<\/h2>/);
  assert.match(dashboard, /rx-reception-kpi-value">\{horarios.length\}/);
  assert.match(dashboard, /Ingresos del día<\/h2>/);
  assert.match(dashboard, /rx-reception-kpi-value">\{formatMoney\(kpis.ingresosHoy\)\}/);
  assert.match(css, /\.rx-reception-kpis\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.rx-reception-kpi\s*\{[^}]*box-shadow: none/);
  assert.match(dashboard, /<RecepcionTabla/);
  for (const accion of ['onCobrar={handlePayment}', 'onAsistencia={handleConfirmAttendance}', 'onReagendar={openReagendar}', 'onCancelar={handleCancel}']) assert.ok(dashboard.includes(accion));
  assert.match(css, /overflow-y: auto/);
});