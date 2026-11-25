const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { normalizarMenor } = require('../backend-cobro/menoresCliente');
const hoy = new Date(2026, 10, 24, 12);
const menor = { fechaNacimiento: '2010-05-20', nombreTutor: 'María López', claveElectorTutor: 'ABCDEF123456789012' };
const completos = { actaNacimiento: true, ineTutor: true, curp: true, credencialEscolar: true };

test('menor puede registrarse sin copias y conserva tutor obligatorio', () => {
  const r = normalizarMenor(menor, {}, hoy);
  assert.equal(Object.values(r.documentosMenor).filter(Boolean).length, 0);
  assert.equal(r.estadoDocumentacion, 'pendiente');
  assert.throws(() => normalizarMenor({ ...menor, nombreTutor: '' }, {}, hoy), /tutor/);
  assert.throws(() => normalizarMenor({ ...menor, claveElectorTutor: '' }, {}, hoy), /elector/);
});
test('límite de edad: requiere tutor el día anterior, pero no al cumplir 18', () => {
  assert.throws(() => normalizarMenor({ fechaNacimiento: '2008-11-25' }, {}, hoy), /tutor/);
  assert.doesNotThrow(() => normalizarMenor({ fechaNacimiento: '2008-11-24' }, {}, hoy));
});
test('rechaza fechas imposibles y futuras', () => {
  for (const fechaNacimiento of ['2010-02-30', '2026-11-25']) {
    assert.throws(() => normalizarMenor({ ...menor, fechaNacimiento }, {}, hoy), /fecha/);
  }
});
test('persiste copias parciales y omitirlas en edición conserva el expediente', () => {
  const r = normalizarMenor({ ...menor, documentosMenor: { actaNacimiento: true, curp: true } }, {}, hoy);
  const editado = normalizarMenor({ nombreTutor: 'Pedro López' }, r, hoy);
  assert.deepEqual(editado.documentosMenor, r.documentosMenor);
  assert.equal(Object.values(editado.documentosMenor).filter(Boolean).length, 2);
});
test('cuatro copias no validan automáticamente y retirar una deja pendiente', () => {
  assert.equal(normalizarMenor({ ...menor, documentosMenor: completos }, {}, hoy).estadoDocumentacion, 'pendiente');
  const r = normalizarMenor({ ...menor, documentosMenor: completos, estadoDocumentacion: 'validada' }, {}, hoy);
  assert.equal(r.estadoDocumentacion, 'validada');
  assert.equal(normalizarMenor({ documentosMenor: { ...completos, curp: false } }, r, hoy).estadoDocumentacion, 'pendiente');
});
test('rechaza documentos desconocidos y valores que no sean booleanos', () => {
  for (const documentosMenor of [null, [], 'todos', { curp: 'false' }, { otro: true }]) {
    assert.throws(() => normalizarMenor({ ...menor, documentosMenor }, {}, hoy), /copias/);
  }
});

function cargarComponente(relativo, mocks) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', relativo), 'utf8');
  const codigo = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(codigo, { module, exports: module.exports, require(name) {
    if (name === 'react/jsx-runtime') return require(name);
    if (name in mocks) return mocks[name];
    throw Error(name);
  } });
  return module.exports;
}
test('formulario renderiza cuatro casillas, etiquetas y contador de copias', () => {
  const campos = cargarComponente('src/sections/webAdministrativa/components/FormField.tsx', {});
  const { ApartadoMenor } = cargarComponente('src/sections/webAdministrativa/features/clientes/DocumentosMenor.tsx', { '../../components/FormField': campos });
  for (const numero of [0, 2, 4]) {
    const documentos = Object.fromEntries(Object.keys(completos).map((k, i) => [k, i < numero]));
    const html = renderToStaticMarkup(React.createElement(ApartadoMenor, {
      nombre: '', clave: '', documentos, onNombre() {}, onClave() {}, onDocumentos() {},
    }));
    assert.equal((html.match(/type="checkbox"/g) || []).length, 4);
    assert.equal((html.match(/checked=""/g) || []).length, numero);
    assert.match(html, new RegExp(`${numero} de 4`));
    for (const texto of ['Acta de nacimiento del menor', 'INE del padre, madre o tutor', 'CURP del menor', 'Credencial escolar del menor']) assert.ok(html.includes(texto));
  }
});