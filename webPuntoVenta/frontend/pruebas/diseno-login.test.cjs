const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'src/auth/LoginPage.tsx');
const source = fs.readFileSync(file, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText;
const sessionSource = fs.readFileSync(path.join(root, 'src/auth/session.ts'), 'utf8');
const sessionCompiled = ts.transpileModule(sessionSource, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText;

function preparar({ error = '', loading = false, fetchImpl } = {}) {
  const cambios = [];
  const destinos = [];
  const storage = new Map();
  const localStorage = {
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  };
  const sessionModule = { exports: {} };
  vm.runInNewContext(sessionCompiled, { module: sessionModule, exports: sessionModule.exports, localStorage });
  const valores = ['personal@nuucleo.test', 'clave-de-prueba', error, loading];
  let indice = 0;
  const modulo = { exports: {} };
  vm.runInNewContext(compiled, {
    module: modulo, exports: modulo.exports,
    require(nombre) {
      if (nombre === 'react') return { ...React, useState() {
        const i = indice++;
        return [valores[i], valor => cambios.push({ indice: i, valor })];
      } };
      if (nombre === 'react/jsx-runtime') return require(nombre);
      if (nombre === './session') return sessionModule.exports;
      if (nombre.endsWith('/BrandLogo')) return { default: () => React.createElement('img', { alt: 'NUUCLEO', src: '/branding/nuucleo-logo.png' }) };
      throw Error(`Importación inesperada: ${nombre}`);
    },
    fetch: fetchImpl ?? (() => { throw Error('No se permiten llamadas reales'); }),
    window: { location: { assign: destino => destinos.push(destino) } },
  }, { filename: file });
  const arbol = modulo.exports.default();
  function buscar(nodo, tipo) {
    if (!nodo || typeof nodo !== 'object') return [];
    return [...(nodo.type === tipo ? [nodo] : []), ...React.Children.toArray(nodo.props?.children).flatMap(hijo => buscar(hijo, tipo))];
  }
  return { cambios, destinos, storage, html: renderToStaticMarkup(arbol),
    formulario: buscar(arbol, 'form')[0], botones: buscar(arbol, 'button'), inputs: buscar(arbol, 'input') };
}

test('login: bienvenida breve, identidad compartida y sin textos anteriores', () => {
  const pagina = preparar();
  assert.match(pagina.html, /Bienvenido a/);
  assert.match(pagina.html, /Gestiona clases, reservaciones, asistencias y ventas en un solo lugar/);
  assert.match(pagina.html, /rx-login-shell/);
  assert.match(pagina.html, /\/branding\/nuucleo-logo.png/);
  assert.doesNotMatch(pagina.html, /El sistema identifica tu rol|Sistema de reservación de clases|Entra directamente al módulo/);
  assert.deepEqual(pagina.inputs.map(input => [input.props.type, input.props.required, input.props.autoComplete]), [
    ['email', true, 'username'], ['password', true, 'current-password'],
  ]);
});

test('login: carga bloquea el botón y el error se anuncia', () => {
  const pagina = preparar({ loading: true, error: 'Credenciales incorrectas' });
  assert.equal(pagina.botones[0].props.disabled, true);
  assert.equal(pagina.formulario.props['aria-busy'], true);
  assert.match(pagina.html, /Verificando/);
  assert.match(pagina.html, /role="alert"/);
});

for (const [rol, destino] of [
  ['administrador', '/administrativa/dashboard'],
  ['recepcion', '/cobro/front-desk/dashboard'],
  ['vendedor', '/'],
]) {
  test(`login: conserva petición, sesión y destino de ${rol}`, async () => {
    const user = { idUsuario: 'prueba', rol, estatus: 'activo' };
    const pagina = preparar({ fetchImpl: async (url, opciones) => {
      assert.equal(url, '/admin/api/auth/login');
      assert.equal(opciones.method, 'POST');
      assert.deepEqual(JSON.parse(opciones.body), { correo: 'personal@nuucleo.test', password: 'clave-de-prueba' });
      return { ok: true, json: async () => ({ token: 'token-simulado', user }) };
    } });
    await pagina.formulario.props.onSubmit({ preventDefault() {} });
    assert.deepEqual(pagina.destinos, [destino]);
    assert.equal(pagina.storage.get('token'), 'token-simulado');
    assert.deepEqual(JSON.parse(pagina.storage.get('administrativa_sesion')), user);
  });
}

test('login: rechazo de credenciales no guarda sesión ni redirige', async () => {
  const pagina = preparar({ fetchImpl: async () => ({ ok: false, json: async () => ({ message: 'Acceso rechazado' }) }) });
  await pagina.formulario.props.onSubmit({ preventDefault() {} });
  assert.ok(pagina.cambios.some(cambio => cambio.indice === 2 && cambio.valor === 'Acceso rechazado'));
  assert.equal(pagina.storage.size, 0);
  assert.deepEqual(pagina.destinos, []);
});