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
    if (nombre === 'react-router') return { useParams: () => parametros, useNavigate: () => apis.navegar ?? (() => {}) };
    if (nombre.endsWith('/api')) return apis;
    if (nombre === './validacionCliente') {
      const validaciones = {};
      vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(path.dirname(filename), 'validacionCliente.ts'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      }).outputText, { exports: validaciones });
      return validaciones;
    }
    return new Proxy({}, { get: (_, prop) => props => React.createElement('section', { 'data-component': String(prop), ...('onClick' in props ? { onClick: props.onClick } : {}) }, props.children) });
  }, ...(apis.window ? { window: apis.window, document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} } } : {}) }, { filename });
  const componente = Object.values(exports)[0];
  return { render(props) { cursor = 0; return componente(props); }, async efectos() { while (efectos.length) efectos.shift()(); await new Promise(resolve => setImmediate(resolve)); }, estados };
}
function nodos(nodo, lista = []) {
  if (!nodo || typeof nodo !== 'object') return lista;
  lista.push(nodo); React.Children.forEach(nodo.props?.children, hijo => nodos(hijo, lista));
  if (nodo.props?.footer) nodos(nodo.props.footer, lista);
  return lista;
}

test('clientes: código de usuario y búsqueda conservan identidad y acciones locales', async () => {
  const socios = [
    { id: 7, nombre: 'Ana Pérez', correo: 'ana@example.com', telefono: '', activo: true, enfermedades: ['Asma'], lesiones: ['Rodilla'] },
    { id: 12, nombre: 'José López', correo: 'jose@example.com', telefono: '', activo: true, codigo: null },
  ];
  const app = montar('clientes/ClientesPage.tsx', { apiCobro: { get: async () => socios } });
  app.render(); await app.efectos();
  const tabla = nodos(app.render()).find(n => n.props?.searchKeys);
  assert.deepEqual(Array.from(tabla.props.searchKeys), ['codigo', 'nombre', 'correo', 'telefono']);
  assert.match(tabla.props.searchPlaceholder, /código/);
  assert.equal(tabla.props.data[0].codigo, 'CLI-7');
  assert.equal(tabla.props.data[1].codigo, 'CLI-12');
  assert.equal(socios[0].codigo, undefined, 'no modifica el registro recibido ni persiste códigos');
  assert.deepEqual(tabla.props.data[0].enfermedades, socios[0].enfermedades);
  assert.deepEqual(tabla.props.data[0].lesiones, socios[0].lesiones);
  const columna = tabla.props.columns.find(c => c.key === 'codigo');
  assert.equal(columna.header, 'Código Usuario');
  assert.match(renderToStaticMarkup(columna.render(tabla.props.data[0])), /CLI-7/);
  assert.match(renderToStaticMarkup(columna.render({})), /—/);
  const acciones = nodos(tabla.props.actions(tabla.props.data[0]));
  assert.ok(acciones.some(n => n.props?.children === 'Acceso móvil'));
  assert.ok(acciones.some(n => n.props?.title === 'Editar'));
  assert.ok(acciones.some(n => n.props?.children === 'Ver perfil'));
});

test('clientes: errores inmediatos, correo obligatorio y duplicados sin guardar', async () => {
  const socio = { id: 7, nombre: 'Ana Pérez', correo: 'ana@example.com', telefono: '' };
  let escrituras = 0;
  const app = montar('clientes/ClientesPage.tsx', { apiCobro: {
    get: async () => [socio], post: async () => { escrituras++; },
  } });
  app.render(); await app.efectos();
  const campo = label => nodos(app.render()).find(n => n.props?.label === label);
  assert.equal(campo('Correo').props.required, true);
  assert.equal(campo('Correo').props.error, undefined);
  campo('Correo').props.onBlur();
  assert.match(campo('Correo').props.error, /obligatorio/);
  campo('Correo').props.onChange({ target: { value: 'ana@' } });
  assert.match(campo('Correo').props.error, /válido/);
  campo('Correo').props.onChange({ target: { value: ' ANA@example.com ' } });
  assert.match(campo('Correo').props.error, /ya está en uso/);
  campo('Correo').props.onChange({ target: { value: 'otra@example.com' } });
  assert.equal(campo('Correo').props.error, '');
  campo('Nombre completo').props.onChange({ target: { value: 'A' } });
  assert.match(campo('Nombre completo').props.error, /3 letras/);
  campo('Nombre completo').props.onChange({ target: { value: 'Ana1' } });
  assert.match(campo('Nombre completo').props.error, /eliminaron/);
  campo('Nombre completo').props.onChange({ target: { value: 'Ana' } });
  assert.equal(campo('Nombre completo').props.error, '');
  campo('Teléfono').props.onChange({ target: { value: '123ab' } });
  assert.match(campo('Teléfono').props.error, /Solo se permiten números/);
  campo('Teléfono').props.onChange({ target: { value: '123' } });
  assert.equal(campo('Teléfono').props.error, '');
  campo('Correo').props.onChange({ target: { value: '' } });
  await nodos(app.render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(escrituras, 0);
  assert.match(campo('Correo').props.error, /obligatorio/);
  const tabla = nodos(app.render()).find(n => n.props?.columns);
  nodos(tabla.props.actions(socio)).find(n => n.props?.title === 'Editar').props.onClick();
  assert.equal(campo('Correo').props.error, '');
});

test('clientes: código editable detecta duplicados al escribir y excluye al mismo cliente', async () => {
  const socios = [
    { id: 7, nombre: 'Ana Pérez', codigo: 'SOC-ANA', correo: 'ana@example.com', telefono: '', activo: true },
    { id: 8, nombre: 'José Pérez', codigo: 'SOC-JOSE', correo: 'jose@example.com', telefono: '', activo: true },
  ];
  let escrituras = 0;
  const app = montar('clientes/ClientesPage.tsx', { apiCobro: { get: async () => socios, patch: async () => { escrituras++; } } });
  app.render(); await app.efectos();
  const tabla = () => nodos(app.render()).find(n => n.props?.columns);
  nodos(tabla().props.actions(socios[0])).find(n => n.props?.title === 'Editar').props.onClick();
  const campo = () => nodos(app.render()).find(n => n.props?.label === 'Código Usuario');
  assert.equal(campo().props.value, 'SOC-ANA');
  campo().props.onChange({ target: { value: 'soc-jose' } });
  assert.equal(campo().props.value, 'SOC-JOSE');
  assert.match(campo().props.error, /ya está en uso/);
  await nodos(app.render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(escrituras, 0);
  campo().props.onChange({ target: { value: 'soc-ana' } });
  assert.equal(campo().props.error, '');
  campo().props.onChange({ target: { value: 'CLI-8' } });
  assert.match(campo().props.error, /reservados/);
  campo().props.onChange({ target: { value: '' } });
  assert.equal(campo().props.error, '');
  assert.equal(tabla().props.data[0].codigo, 'SOC-ANA');
});

test('clientes: consulta disponibilidad remota sin guardar y bloquea un duplicado no cargado', async () => {
  const timers = [];
  const consultas = [];
  const ventana = { setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {},
    addEventListener() {}, removeEventListener() {}, setInterval() {}, clearInterval() {} };
  const app = montar('clientes/ClientesPage.tsx', { window: ventana, apiCobro: {
    get: async ruta => { consultas.push(ruta); return ruta.includes('codigo-disponible') ? { disponible: false } : []; },
  } });
  app.render(); await app.efectos();
  nodos(app.render()).find(n => n.type === 'button' && n.props?.children?.some?.(c => c === 'Nuevo cliente')).props.onClick();
  const campo = () => nodos(app.render()).find(n => n.props?.label === 'Código Usuario');
  campo().props.onChange({ target: { value: 'SOC-REMOTO' } });
  app.render(); await app.efectos();
  assert.equal(nodos(app.render()).find(n => n.props?.form === 'form-cliente').props.disabled, true);
  assert.equal(timers.length, 1);
  await timers[0]();
  assert.match(campo().props.error, /ya está en uso/);
  assert.ok(consultas.some(ruta => ruta === '/clientes/codigo-disponible?codigo=SOC-REMOTO'));
});

test('clientes: filtros de escritura y validación en alta y edición', async () => {
  for (const editar of [false, true]) {
    const escrituras = [];
    const socio = { id: 7, nombre: 'Ana Pérez', correo: '', telefono: '', activo: true };
    const app = montar('clientes/ClientesPage.tsx', { apiCobro: {
      get: async () => [socio],
      post: async (ruta, cuerpo) => { escrituras.push(cuerpo); return { cliente: { id: 8, ...cuerpo } }; },
      patch: async (ruta, cuerpo) => { escrituras.push(cuerpo); return { cliente: { id: 7, ...cuerpo } }; },
    } });
    app.render(); await app.efectos();
    if (editar) {
      const tabla = nodos(app.render()).find(n => n.props?.columns);
      nodos(tabla.props.actions(socio)).find(n => n.props?.title === 'Editar').props.onClick();
    }
    const campo = label => nodos(app.render()).find(n => n.props?.label === label);
    campo('Nombre completo').props.onChange({ target: { value: 'José 123 Pérez!@' } });
    assert.equal(app.estados[5].nombre, 'José  Pérez');
    campo('Teléfono').props.onChange({ target: { value: '55ab123456789012' } });
    assert.equal(app.estados[5].telefono, '5512345678');
    assert.equal(campo('Teléfono').props.maxLength, 10);
    assert.equal(campo('Teléfono').props.inputMode, 'numeric');
    assert.equal(campo('Correo').props.maxLength, 254);
    for (const cambio of [{ nombre: 'Ana1' }, { nombre: 'A  B' }, { nombre: 'Ana!' }, { telefono: '12345678901' }, { telefono: '12ab' }, { correo: 'a..b@example.com' }, { correo: 'a@-example.com' }, { correo: 'a@b' }]) {
      app.estados[5] = { ...socio, enfermedades: [], lesiones: [], ...cambio };
      await nodos(app.render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
      assert.equal(escrituras.length, 0);
      assert.ok(app.estados[6]);
    }
    app.estados[5] = { ...socio, enfermedades: [], lesiones: [], nombre: ' José Muñoz ', telefono: '0123456789', correo: 'ana+ventas@example.com' };
    await nodos(app.render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.equal(escrituras.length, 1);
    assert.equal(escrituras[0].nombre, 'José Muñoz');
    assert.equal(escrituras[0].telefono, '0123456789');
  }
});

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

test('perfil de Recepción conserva enfermedades y lesiones sin inventar métricas físicas', async () => {
  const app = montar('clientes/ClienteDetalle.tsx', { apiCobro: { get: async ruta => ruta === '/clientes'
    ? [{ id: 7, nombre: 'Ana Salud', activo: true, enfermedades: ['Asma'], lesiones: ['Rodilla'] }] : [] } }, { id: '7' });
  app.render(); await app.efectos();
  assert.deepEqual(Array.from(app.estados[1].enfermedades), ['Asma']);
  assert.deepEqual(Array.from(app.estados[1].lesiones), ['Rodilla']);
  app.estados[0] = 'salud';
  const arbol = app.render();
  const etiquetas = nodos(arbol).filter(n => n.props?.items);
  assert.equal(etiquetas.length, 2);
  assert.deepEqual(Array.from(etiquetas[0].props.items), ['Asma']);
  assert.doesNotMatch(renderToStaticMarkup(arbol), /NaN|Métricas Físicas/);
});

test('clientes: edición envía salud y mantiene columnas y campos opcionales', async () => {
  const llamadas = [];
  const socio = { id: 7, nombre: 'Ana Salud', correo: 'ana@example.com', telefono: '', activo: true, enfermedades: ['Asma'], lesiones: ['Rodilla'] };
  const app = montar('clientes/ClientesPage.tsx', { apiCobro: {
    get: async () => [socio], patch: async (ruta, cuerpo) => { llamadas.push({ ruta, cuerpo }); return { cliente: { ...socio, ...cuerpo } }; },
  } });
  app.render(); await app.efectos();
  const tabla = nodos(app.render()).find(n => n.props?.columns);
  assert.ok(tabla.props.columns.some(c => c.key === 'enfermedades'));
  assert.ok(tabla.props.columns.some(c => c.key === 'lesiones'));
  nodos(tabla.props.actions(socio)).find(n => n.props?.title === 'Editar').props.onClick();
  assert.deepEqual(Array.from(app.estados[5].enfermedades), ['Asma']);
  app.estados[5] = { ...app.estados[5], lesiones: [] };
  await nodos(app.render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(llamadas[0].ruta, '/clientes/7');
  assert.deepEqual(Array.from(llamadas[0].cuerpo.enfermedades), ['Asma']);
  assert.equal(llamadas[0].cuerpo.lesiones.length, 0);
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
  assert.match(dashboard, /vista === 'clientes' \? <ClientesPage rutaClientes="\/front-desk\/clientes"/);
  assert.match(app, /path="\/front-desk\/clientes\/:id"[\s\S]*?allowedRoles=\{\['recepcion'\]\}[\s\S]*?<Dashboard vista="cliente-detalle"/);
  assert.match(dashboard, /<ClienteDetalle rutaClientes="\/front-desk\/clientes"/);
});

test('Recepción permite ver perfil, editar y cambiar estatus sin salir del módulo', async () => {
  const navegaciones = [], cambios = [];
  const socio = { id: 7, nombre: 'Ana Real', correo: 'ana@example.com', telefono: '123', activo: true, enfermedades: ['Asma'], lesiones: ['Rodilla'] };
  const props = { rutaClientes: '/front-desk/clientes' };
  const app = montar('clientes/ClientesPage.tsx', { navegar: ruta => navegaciones.push(ruta), apiCobro: {
    get: async () => [socio],
    patch: async (ruta, cuerpo) => { cambios.push({ ruta, cuerpo }); return { cliente: { ...socio, ...cuerpo } }; },
  } });
  app.render(props); await app.efectos();
  const acciones = () => nodos(nodos(app.render(props)).find(n => n.props?.columns).props.actions(app.estados[0][0]));
  acciones().find(n => n.props?.title === 'Ver perfil e historial').props.onClick();
  assert.equal(navegaciones[0], '/front-desk/clientes/7');
  acciones().find(n => n.props?.title === 'Editar').props.onClick();
  assert.equal(app.estados[3], true);
  assert.equal(app.estados[5].lesiones[0], 'Rodilla');
  app.estados[5] = { ...app.estados[5], telefono: '456' };
  await nodos(app.render(props)).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(cambios[0].ruta, '/clientes/7');
  assert.equal(cambios[0].cuerpo.telefono, '456');
  assert.ok(acciones().some(n => n.props?.title === 'Dar de baja conservando historial'));
  acciones().find(n => n.props?.['aria-label'] === 'Desactivar a Ana Real').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cambios[1].cuerpo.activo, false);
  acciones().find(n => n.props?.['aria-label'] === 'Activar a Ana Real').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cambios[2].cuerpo.activo, true);
});

test('perfil de Recepción vuelve a su lista en éxito, error y cliente inexistente', async () => {
  for (const caso of ['exito', 'error', 'inexistente']) {
    const navegaciones = [];
    const app = montar('clientes/ClienteDetalle.tsx', { navegar: ruta => navegaciones.push(ruta), apiCobro: {
      get: async ruta => {
        if (caso === 'error') throw new Error('Sin conexión');
        return ruta === '/clientes' && caso === 'exito' ? [{ id: 7, nombre: 'Ana', activo: true }] : [];
      },
    } }, { id: '7' });
    const props = { rutaClientes: '/front-desk/clientes' };
    app.render(props); await app.efectos();
    nodos(app.render(props)).find(n => n.type === 'button').props.onClick();
    assert.equal(navegaciones[0], '/front-desk/clientes');
  }
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
  assert.match(clientes, /searchKeys=\{\['codigo', 'nombre', 'correo', 'telefono'\]\}/);
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