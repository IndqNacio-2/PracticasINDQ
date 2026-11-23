const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

test('alta de usuario: prefijo fijo por rol, número elegible y duplicado entre roles', async () => {
  const estados = []; let cursor = 0; const efectos = [];
  const hooks = { ...React, useState(v) { const i = cursor++; if (!(i in estados)) estados[i] = v;
    return [estados[i], v => { estados[i] = typeof v === 'function' ? v(estados[i]) : v; }]; },
    useRef(v) { const i = cursor++; if (!(i in estados)) estados[i] = { current: v }; return estados[i]; },
    useCallback: f => f, useEffect(f, deps) { const i = cursor++; if (!(i in estados) || deps.some((d, j) => d !== estados[i][j])) { estados[i] = deps; efectos.push(f); } },
  };
  const reglas = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../shared/codigoUsuario.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports: reglas });
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/sections/webAdministrativa/features/usuarios/UsuariosPage.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, URLSearchParams, window: { setTimeout() { return 1; }, clearTimeout() {} }, require(n) {
    if (n === 'react') return hooks;
    if (n === 'react/jsx-runtime') return require(n);
    if (n.endsWith('/codigoUsuario')) return reglas;
    if (n.endsWith('/AuthContext')) return { useAuth: () => ({ hasRole: () => true }) };
    if (n.endsWith('/api')) return { api: { get: async () => [
      { idUsuario: 'otro', codigoAcceso: 'ADM00123', rol: 'administrador', nombre: 'Ana', apellidos: 'Pérez' },
      { idUsuario: 'edgar', codigoAcceso: 'VEN1234', rol: 'vendedor', nombre: 'Edgar', apellidos: 'Rodríguez' },
      { idUsuario: 'antiguo', codigoAcceso: 'A009', rol: 'administrador', nombre: 'Anterior', apellidos: 'Usuario' },
    ] } };
    return new Proxy({}, { get: (_, prop) => props => React.createElement('section', { ...props, 'data-component': String(prop) }, props.children) });
  } });
  function nodos(n, a = []) { if (!n || typeof n !== 'object') return a; a.push(n); React.Children.forEach(n.props?.children, c => nodos(c, a)); return a; }
  const render = () => { cursor = 0; return nodos(exports.UsuariosPage()); };
  const efectosPendientes = async () => { while (efectos.length) efectos.shift()(); await new Promise(r => setImmediate(r)); };
  render(); await efectosPendientes();
  render().find(n => n.type === 'button' && JSON.stringify(n.props.children).includes('Nuevo usuario')).props.onClick();
  const rol = () => render().find(n => n.props?.label === 'Rol');
  const numero = () => render().find(n => n.props?.id === 'numero-acceso');
  const prefijo = () => render().find(n => n.props?.['aria-label'] === 'Prefijo automático');
  assert.equal(numero().props.disabled, true);
  rol().props.onChange({ target: { value: 'vendedor' } });
  assert.equal(prefijo().props.children, 'VEN');
  numero().props.onChange({ target: { value: '12x3' } });
  assert.equal(numero().props.value, '123');
  assert.ok(render().some(n => n.props?.role === 'alert' && /ya está en uso/.test(n.props.children)));
  assert.equal(render().find(n => n.type === 'button' && n.props.onClick?.name === 'save').props.disabled, true);
  rol().props.onChange({ target: { value: 'entrenador' } });
  assert.equal(prefijo().props.children, 'ENT');
  assert.equal(numero().props.value, '123');
  rol().props.onChange({ target: { value: 'recepcion' } });
  assert.equal(prefijo().props.children, 'REC');
  rol().props.onChange({ target: { value: 'administrador' } });
  assert.equal(prefijo().props.children, 'ADM');
  numero().props.onChange({ target: { value: '456' } });
  assert.ok(!render().some(n => n.props?.role === 'alert' && /ya está en uso/.test(n.props.children)));
  assert.ok(render().some(n => n.props?.role === 'status' && /Verificando/.test(n.props.children)));

  const editar = id => {
    const tabla = render().find(n => n.props?.searchKeys);
    const usuario = tabla.props.data.find(u => u.idUsuario === id);
    nodos(tabla.props.actions(usuario)).find(n => n.type === 'button' && n.props.title === 'Editar').props.onClick();
  };
  editar('edgar');
  assert.equal(prefijo().props.children, 'VEN');
  assert.equal(numero().props.value, '1234');
  assert.ok(!render().some(n => n.props?.role === 'status' && /Verificando/.test(n.props.children)));
  rol().props.onChange({ target: { value: 'administrador' } });
  assert.equal(prefijo().props.children, 'ADM');
  assert.equal(numero().props.value, '1234');
  assert.ok(!render().some(n => n.props?.role === 'alert' && /ya está en uso/.test(n.props.children)), 'excluye al usuario editado');
  numero().props.onChange({ target: { value: '00123' } });
  assert.ok(render().some(n => n.props?.role === 'alert' && /ya está en uso/.test(n.props.children)));
  editar('antiguo');
  assert.equal(prefijo().props.children, 'A');
  assert.equal(numero().props.value, '009');
  assert.ok(!render().some(n => n.props?.role === 'status' && /Verificando/.test(n.props.children)));
  numero().props.onChange({ target: { value: '010' } });
  assert.equal(prefijo().props.children, 'ADM');
  assert.equal(numero().props.value, '010');
});