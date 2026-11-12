const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const base = path.resolve(__dirname, '../src/sections/webAdministrativa/features');

function montar(archivo, apis, parametros = {}) {
  const estados = []; const efectos = []; let cursor = 0;
  const hooks = { ...React,
    useState(valor) { const i = cursor++; if (!(i in estados)) estados[i] = valor; return [estados[i], v => { estados[i] = typeof v === 'function' ? v(estados[i]) : v; }]; },
    useCallback: fn => fn, useEffect: (fn, deps) => { const i = cursor++; if (!(i in estados) || deps.some((d, j) => d !== estados[i][j])) { estados[i] = deps; efectos.push(fn); } },
  };
  const exports = {};
  const filename = path.join(base, archivo);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Error, require(nombre) {
    if (nombre === 'react') return hooks;
    if (nombre === 'react/jsx-runtime') return require('react/jsx-runtime');
    if (nombre === 'react-router') return { useParams: () => parametros, useNavigate: () => () => {} };
    if (nombre.endsWith('/api')) return apis;
    return new Proxy({}, { get: (_, prop) => props => React.createElement('section', { 'data-component': String(prop), ...('onClick' in props ? { onClick: props.onClick } : {}) }, props.children) });
  } }, { filename });
  const componente = Object.values(exports)[0];
  return { render(props) { cursor = 0; return componente(props); }, async efectos() { while (efectos.length) efectos.shift()(); await new Promise(resolve => setImmediate(resolve)); }, estados };
}
function nodos(nodo, lista = []) {
  if (!nodo || typeof nodo !== 'object') return lista;
  lista.push(nodo); React.Children.forEach(nodo.props?.children, hijo => nodos(hijo, lista));
  if (nodo.props?.footer) nodos(nodo.props.footer, lista);
  return lista;
}

test('perfil consulta APIs reales, filtra por ID y cambia de cliente sin datos anteriores', async () => {
  const parametros = { id: '7' }; const llamadas = [];
  const apiCobro = { get: async ruta => {
    llamadas.push(ruta);
    return ruta === '/clientes' ? [{ id: 7, nombre: 'Ana Real', activo: true, correo: 'ana@example.test', telefono: '123' }]
      : [{ id: 1, clienteId: 7, class: 'Yoga Real', fecha: '2099-01-01', time: '10:00', status: 'pagado' },
        { id: 2, clienteId: 8, class: 'Reserva ajena', status: 'pendiente' }];
  } };
  const app = montar('clientes/ClienteDetalle.tsx', { apiCobro }, parametros);
  assert.match(renderToStaticMarkup(app.render()), /Cargando perfil/);
  await app.efectos();
  assert.match(renderToStaticMarkup(app.render()), /Ana Real/);
  app.estados[0] = 'historial';
  const html = renderToStaticMarkup(app.render());
  assert.match(html, /Yoga Real/); assert.doesNotMatch(html, /Reserva ajena/);
  assert.deepEqual(llamadas, ['/clientes', '/reservas']);
  parametros.id = '8'; app.render(); await app.efectos();
  assert.match(renderToStaticMarkup(app.render()), /Cliente no encontrado/);
});

test('perfil muestra error de API sin recurrir a datos de demostración', async () => {
  const app = montar('clientes/ClienteDetalle.tsx', { apiCobro: { get: async () => { throw new Error('API no disponible'); } } }, { id: '7' });
  app.render(); await app.efectos(); assert.match(renderToStaticMarkup(app.render()), /API no disponible/);
});

test('formulario de clases bloquea capacidades decimales, nombre vacío y precio negativo antes de enviar', async () => {
  let escrituras = 0;
  const app = montar('clases/ClasesPage.tsx', { api: { get: async () => [], post: async () => { escrituras++; } } });
  app.render(); await app.efectos();
  for (const cambio of [{ capacidad: '1.5' }, { capacidad: '0' }, { capacidad: '-1' }, { nombre: '  ' }, { precio: '-1' }]) {
    app.estados[4] = { nombre: 'Yoga', capacidad: '10', precio: '100', color: '#111', estatus: 'activo', ...cambio };
    const boton = nodos(app.render()).find(n => n.type === 'button' && React.Children.toArray(n.props.children).includes('Crear clase'));
    assert.ok(boton); await boton.props.onClick(); assert.equal(escrituras, 0);
    assert.ok(app.estados[6]);
  }
});

test('formulario clientes bloquea correo inválido antes de llamar al backend', async () => {
  let escrituras = 0;
  const app = montar('clientes/ClientesPage.tsx', { apiCobro: { get: async () => [], post: async () => { escrituras++; } } });
  app.render(); await app.efectos();
  app.estados[5] = { nombre: 'Ana Real', correo: 'no-es-correo', telefono: '', activo: true };
  const boton = nodos(app.render()).find(n => n.type === 'button' && React.Children.toArray(n.props.children).includes('Registrar cliente'));
  assert.ok(boton); await nodos(app.render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); assert.equal(escrituras, 0);
  assert.match(app.estados[6], /correo electrónico válido/);
});

test('recepción reutiliza el alta real y oculta acciones administrativas', async () => {
  const llamadas = [];
  const app = montar('clientes/ClientesPage.tsx', { apiCobro: {
    get: async () => [],
    post: async (ruta, cuerpo) => { llamadas.push({ ruta, cuerpo }); return { cliente: { id: 21, ...cuerpo } }; },
  } });
  app.render({ soloRegistro: true }); await app.efectos();
  let arbol = app.render({ soloRegistro: true });
  const tabla = nodos(arbol).find(n => n.props?.emptyMessage === 'No hay clientes que mostrar');
  assert.ok(tabla); assert.equal(tabla.props.actions, undefined);
  app.estados[5] = { nombre: ' Ana Nueva ', correo: ' ana@example.test ', telefono: ' 123 ', activo: true };
  const boton = nodos(app.render({ soloRegistro: true })).find(n => n.type === 'button' && React.Children.toArray(n.props.children).includes('Registrar cliente'));
  assert.equal(boton.props.form, 'form-cliente');
  await nodos(app.render({ soloRegistro: true })).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].ruta, '/clientes');
  assert.equal(llamadas[0].cuerpo.nombre, 'Ana Nueva');
  assert.equal(app.estados[0][0].id, 21);
  assert.equal(app.estados[3], false);
  arbol = app.render();
  assert.equal(typeof nodos(arbol).find(n => n.props?.emptyMessage === 'No hay clientes que mostrar').props.actions, 'function');
});

test('clientes tiene ruta protegida y acceso en el sidebar de recepción', () => {
  const app = fs.readFileSync(path.resolve(base, '../../webCobro/App.jsx'), 'utf8');
  const dashboard = fs.readFileSync(path.resolve(base, '../../webCobro/pages/dashboard.jsx'), 'utf8');
  assert.match(app, /path="\/front-desk\/clientes"[\s\S]*?allowedRoles=\{\['recepcion'\]\}[\s\S]*?<Dashboard vista="clientes"/);
  assert.match(dashboard, /to="\/front-desk\/clientes"/);
  assert.match(dashboard, /vista === 'clientes' \? <ClientesPage soloRegistro/);
});

test('alta de cliente usa el modal de recepción con formulario desplazable y footer separado', () => {
  const app = montar('clientes/ClientesPage.tsx', {});
  const arbol = app.render();
  const modal = nodos(arbol).find(n => n.props?.variant === 'reception');
  assert.ok(modal); assert.ok(modal.props.subtitle);
  assert.ok(modal.props.footer);
  const form = nodos(arbol).find(n => n.type === 'form');
  assert.equal(form.props.className, 'rx-modal-body rx-form-stack');
  const fields = nodos(form).find(n => n.type === 'fieldset');
  assert.equal(fields.props.className, 'rx-form-stack rx-membership-fields');
  const submit = nodos(modal.props.footer).find(n => n.props?.type === 'submit');
  assert.equal(submit.props.form, form.props.id);
  assert.equal(submit.props.onClick, undefined);
});

test('diálogo de clientes queda sobre el fondo desenfocado en ambas variantes', () => {
  const css = fs.readFileSync(path.resolve(base, '../../../styles/pos-ui.css'), 'utf8');
  assert.match(css, /\.rx-modal-layer > \.rx-modal-backdrop\s*\{\s*z-index: 0;/);
  assert.match(css, /\.rx-modal-layer > :is\(\.rx-modal, \.rx-modal-panel\)\s*\{\s*position: relative;\s*z-index: 1;/);
});

test('clientes se actualiza automáticamente y elimina el botón manual', () => {
  const codigo = fs.readFileSync(path.join(base, 'clientes/ClientesPage.tsx'), 'utf8');
  assert.doesNotMatch(codigo, />\s*Actualizar\s*</);
  for (const evento of ['EVENTO_CAMBIO_APLICACION', "'storage'", "'focus'"]) {
    assert.ok(codigo.includes(`window.addEventListener(${evento},`));
    assert.ok(codigo.includes(`window.removeEventListener(${evento},`));
  }
  assert.match(codigo, /window\.setInterval\(alVolver, 10000\)/);
  assert.match(codigo, /window\.clearInterval\(intervalo\)/);
  assert.match(codigo, /if \(enCurso\) \{ pendiente = true; return; \}/);
});

test('tabla con diseño separado conserva búsqueda y paginación sin afectar su variante original', () => {
  const app = montar('../components/DataTable.tsx', {});
  const props = { variant: 'spaced', columns: [{ key: 'nombre', header: 'Cliente' }],
    data: Array.from({ length: 12 }, (_, i) => ({ nombre: `Cliente ${i + 1}` })), searchKeys: ['nombre'] };
  let arbol = app.render(props);
  let html = renderToStaticMarkup(arbol);
  assert.match(html, /rx-data-list-scroll/);
  assert.match(html, /Página 1 de 2/);
  const siguiente = nodos(arbol).find(n => n.props?.['aria-label'] === 'Página siguiente');
  siguiente.props.onClick();
  html = renderToStaticMarkup(app.render(props));
  assert.match(html, /Página 2 de 2/); assert.match(html, /Cliente 12/);
  const buscar = nodos(app.render(props)).find(n => n.type === 'input');
  buscar.props.onChange({ target: { value: 'Cliente 12' } });
  html = renderToStaticMarkup(app.render(props));
  assert.match(html, /Cliente 12/); assert.doesNotMatch(html, />Cliente 11</);
  assert.doesNotMatch(renderToStaticMarkup(app.render({ ...props, variant: 'default' })), /rx-data-list/);
});

test('clientes comparte diseño de la guía sin estilos inline ni colores locales', () => {
  const clientes = fs.readFileSync(path.join(base, 'clientes/ClientesPage.tsx'), 'utf8');
  const css = fs.readFileSync(path.resolve(base, '../../../styles/clientes-ui.css'), 'utf8');
  assert.match(clientes, /variant="spaced"/);
  assert.match(clientes, /rx-admin-dashboard rx-clientes/);
  assert.match(clientes, /rx-page-header rx-admin-dashboard-header/);
  assert.match(clientes, /rx-page-content rx-clientes-content/);
  assert.match(clientes, /Clientes registrados/);
  assert.match(clientes, /searchKeys=\{\['nombre', 'correo', 'telefono'\]\}/);
  assert.doesNotMatch(clientes, /style=|#[0-9a-f]{6}/i);
  assert.match(css, /border-spacing: 0 6px/);
  assert.match(css, /font-family: var\(--rx-font\)/);
  assert.match(css, /@media \(max-width: 899px\)/);
  assert.match(css, /focus-visible/);
});

test('panel de clientes mantiene columnas y acciones sin convertir filas en tarjetas', () => {
  const app = montar('../components/DataTable.tsx', {});
  const props = { variant: 'panel', columns: [{ key: 'nombre', header: 'Cliente' }, { key: 'telefono', header: 'Teléfono' }],
    data: [{ nombre: 'Ana', telefono: '123' }], searchKeys: ['nombre'], searchPlaceholder: 'Buscar cliente',
    actions: () => React.createElement('button', null, 'Ver perfil') };
  let html = renderToStaticMarkup(app.render(props));
  assert.match(html, /rx-data-list--panel/);
  assert.match(html, /Buscar cliente/);
  assert.match(html, /Ver perfil/);
  assert.match(html, /1 registros · Página 1 de 1/);
  const buscar = nodos(app.render(props)).find(n => n.type === 'input');
  buscar.props.onChange({ target: { value: 'No existe' } });
  html = renderToStaticMarkup(app.render(props));
  assert.match(html, /Sin registros/);
  assert.match(html, /colSpan="3"/i);
  const css = fs.readFileSync(path.resolve(base, '../../../styles/clientes-ui.css'), 'utf8');
  assert.match(css, /\.rx-data-list--panel table \{ border-collapse: collapse; border-spacing: 0;/);
});