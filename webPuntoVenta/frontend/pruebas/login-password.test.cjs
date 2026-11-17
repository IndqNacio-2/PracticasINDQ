const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

test('login: icono muestra y oculta contraseña sin cambiar su valor ni enviar el formulario', () => {
  const estados = [];
  let cursor = 0;
  let peticiones = 0;
  const exports = {};
  const archivo = path.resolve(__dirname, '../src/auth/LoginPage.tsx');
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(archivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, fetch() { peticiones++; }, require(nombre) {
    if (nombre === 'react') return { useState(inicial) {
      const indice = cursor++;
      if (!(indice in estados)) estados[indice] = inicial;
      return [estados[indice], valor => { estados[indice] = typeof valor === 'function' ? valor(estados[indice]) : valor; }];
    } };
    if (nombre === 'react/jsx-runtime') return require(nombre);
    if (nombre.endsWith('/BrandLogo') || nombre.endsWith('/MaterialIcon')) return { default: () => null };
    if (nombre === './session') return {};
    throw new Error(`Import inesperado: ${nombre}`);
  } });
  function nodos(nodo, lista = []) {
    if (!nodo || typeof nodo !== 'object') return lista;
    lista.push(nodo);
    React.Children.forEach(nodo.props?.children, hijo => nodos(hijo, lista));
    return lista;
  }
  const render = () => { cursor = 0; return nodos(exports.default()); };
  const campo = () => render().find(n => n.props?.id === 'login-password');
  const boton = () => render().find(n => n.props?.['aria-controls'] === 'login-password');
  assert.equal(campo().props.type, 'password');
  assert.equal(campo().props.required, true);
  assert.equal(campo().props.autoComplete, 'current-password');
  campo().props.onChange({ target: { value: 'Clave de prueba' } });
  assert.equal(boton().props.type, 'button');
  assert.equal(boton().props['aria-label'], 'Mostrar contraseña');
  boton().props.onClick();
  assert.equal(campo().props.type, 'text');
  assert.equal(campo().props.value, 'Clave de prueba');
  assert.equal(boton().props['aria-label'], 'Ocultar contraseña');
  assert.equal(boton().props.children.props.name, 'visibility_off');
  boton().props.onClick();
  assert.equal(campo().props.type, 'password');
  assert.equal(campo().props.value, 'Clave de prueba');
  assert.equal(boton().props.children.props.name, 'visibility');
  assert.equal(peticiones, 0);
});