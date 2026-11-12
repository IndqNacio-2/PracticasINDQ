const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Ejecuta los handlers reales con hooks/HTTP simulados, sin navegador ni BD.
function montar(relative, api = {}) {
  const states = [];
  let cursor = 0;
  let effects = [];
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useCallback(fn) { return fn; },
    useEffect(fn) { effects.push(fn); },
  };
  class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const filename = path.join(__dirname, relative);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    Error,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name.endsWith('/api')) return { apiCobro: api, ApiError };
      return new Proxy({}, { get: (_, key) => key });
    },
    window: { confirm: () => true },
  }, { filename });
  return {
    render(props) { cursor = 0; effects = []; return Object.values(exports)[0](props); },
    effects: async () => { for (const fn of effects) await fn(); await new Promise(resolve => setImmediate(resolve)); },
  };
}

function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(item => nodes(item, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const find = (tree, type) => nodes(tree, node => node.type === type)[0];
const button = (tree, title) => nodes(tree, node => node.type === 'button' && node.props.title === title)[0];
const cliente = { id: 18, nombre: 'pedro lomas', correo: 'pedro@gmail.com', telefono: '6682433048', membresia: 'Básica', activo: true, vigencia_hasta: '2026-10-29' };
const pageFile = 'src/sections/webAdministrativa/features/clientes/ClientesPage.tsx';

test('editar usa la respuesta persistida y permite vaciar correo sin recargar', async () => {
  let gets = 0;
  let body;
  const app = montar(pageFile, {
    get: async () => { gets++; return [cliente]; },
    patch: async (_, data) => { body = data; return { cliente: { ...cliente, ...data } }; },
  });
  app.render(); await app.effects();
  let tree = app.render();
  button(find(tree, 'DataTable').props.actions(cliente), 'Editar').props.onClick();
  tree = app.render();
  nodes(tree, n => n.type === 'InputField' && n.props.label === 'Correo')[0].props.onChange({ target: { value: '' } });
  tree = app.render();
  await nodes(tree, n => n.type === 'button' && n.props.children === 'Guardar cambios')[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  tree = app.render();
  assert.equal(body.correo, '');
  assert.equal(find(tree, 'DataTable').props.data[0].correo, '');
  assert.equal(gets, 1);
  assert.equal(find(tree, 'DataState').props.loading, false);
});

test('baja de socio vencido envía activo false, no intenta activarlo', async () => {
  let body;
  const app = montar(pageFile, {
    get: async () => [cliente],
    patch: async (_, data) => { body = data; return { cliente: { ...cliente, ...data } }; },
  });
  app.render(); await app.effects();
  const tree = app.render();
  button(find(tree, 'DataTable').props.actions(cliente), 'Desactivar (dar de baja)').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(body.activo, false);
  assert.equal(find(app.render(), 'DataTable').props.data[0].activo, false);
});

test('error al eliminar conserva tabla/datos y muestra motivo sin cargar otra vez', async () => {
  const app = montar(pageFile, {
    get: async () => [cliente],
    del: async () => { throw new Error('Historial asociado'); },
  });
  app.render(); await app.effects();
  button(find(app.render(), 'DataTable').props.actions(cliente), 'Eliminar definitivamente').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  const tree = app.render();
  assert.equal(find(tree, 'DataTable').props.data.length, 1);
  assert.equal(find(tree, 'DataState').props.error, undefined);
  assert.equal(nodes(tree, n => n.props?.role === 'alert')[0].props.children, 'Historial asociado');
});

test('conflicto de correo conserva modal abierto y no altera la fila', async () => {
  const app = montar(pageFile, {
    get: async () => [cliente],
    patch: async () => { throw new Error('Ese correo ya está en uso por otro cliente.'); },
  });
  app.render(); await app.effects();
  button(find(app.render(), 'DataTable').props.actions(cliente), 'Editar').props.onClick();
  let tree = app.render();
  nodes(tree, n => n.type === 'button' && n.props.children === 'Guardar cambios')[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  tree = app.render();
  assert.equal(find(tree, 'Modal').props.open, true);
  assert.equal(find(tree, 'DataTable').props.data[0].correo, cliente.correo);
  assert.equal(nodes(tree, n => n.type === 'p' && n.props.children === 'Ese correo ya está en uso por otro cliente.').length, 1);
});

test('paginación mantiene página al editar y ajusta al borrar última fila', () => {
  const table = montar('src/sections/webAdministrativa/components/DataTable.tsx');
  const data = Array.from({ length: 21 }, (_, id) => ({ id, nombre: `Socio ${id}` }));
  const props = { data, columns: [{ key: 'nombre', header: 'Cliente' }], searchKeys: ['nombre'] };
  let tree = table.render(props);
  nodes(tree, n => n.type === 'button' && n.props.children === 3)[0].props.onClick();
  tree = table.render({ ...props, data: data.map(r => ({ ...r })) });
  assert.equal(nodes(tree, n => n.type === 'span')[0].props.children.join(''), '21 registros · Página 3 de 3');
  tree = table.render({ ...props, data: data.slice(0, 20) });
  assert.equal(nodes(tree, n => n.type === 'span')[0].props.children.join(''), '20 registros · Página 2 de 2');
});