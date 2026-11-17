const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function cargar() {
  let texto = '';
  const exports = {};
  const archivo = path.resolve(__dirname, '../src/sections/webAdministrativa/features/clientes/SaludEtiquetas.tsx');
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(archivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require(nombre) {
    if (nombre === 'react') return { useState: () => [texto, valor => { texto = valor; }] };
    return require(nombre);
  } });
  return exports;
}
function nodos(nodo, lista = []) {
  if (!nodo || typeof nodo !== 'object') return lista;
  lista.push(nodo);
  React.Children.forEach(nodo.props?.children, hijo => nodos(hijo, lista));
  return lista;
}

test('salud: agregar con Enter/botón, evitar duplicados, guardar al salir y quitar etiquetas', () => {
  const { default: Lista } = cargar();
  let items = [];
  const render = () => nodos(Lista({ label: 'Enfermedades', items, onChange: valor => { items = valor; } }));
  const escribir = value => render().find(n => n.type === 'input').props.onChange({ target: { value } });
  escribir(' Asma ');
  let prevenido = false;
  render().find(n => n.type === 'input').props.onKeyDown({ key: 'Enter', preventDefault() { prevenido = true; } });
  assert.equal(prevenido, true);
  assert.deepEqual(Array.from(items), ['Asma']);
  escribir('asma');
  render().find(n => n.type === 'button').props.onClick();
  assert.equal(items.length, 1);
  escribir('Diabetes');
  render().find(n => n.type === 'input').props.onBlur();
  assert.deepEqual(Array.from(items), ['Asma', 'Diabetes']);
  render().find(n => n.props?.['aria-label'] === 'Quitar Asma').props.onClick();
  assert.deepEqual(Array.from(items), ['Diabetes']);
  assert.equal(render().find(n => n.type === 'input').props.maxLength, 60);
  assert.equal(render().find(n => n.type === 'button').props.disabled, true);
});

test('salud: etiquetas visibles escapan HTML y muestran el estado vacío', () => {
  const { SaludEtiquetas } = cargar();
  assert.match(renderToStaticMarkup(SaludEtiquetas({})), /Ninguna registrada/);
  const html = renderToStaticMarkup(SaludEtiquetas({ items: ['Asma', '<script>'] }));
  assert.match(html, /Asma/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});