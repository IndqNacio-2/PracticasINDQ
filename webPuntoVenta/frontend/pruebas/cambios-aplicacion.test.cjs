const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('avisa solo escrituras exitosas de la API y conserva respuestas y errores', async () => {
  const archivo = path.resolve(__dirname, '../src/services/cambiosAplicacion.ts');
  const modulo = { exports: {} };
  const eventos = [];
  const almacenados = [];
  let respuesta = { ok: true };
  const original = async () => { if (respuesta instanceof Error) throw respuesta; return respuesta; };
  const ventana = { fetch: original, location: { href: 'http://localhost:5173/cobro', origin: 'http://localhost:5173' }, dispatchEvent: e => eventos.push(e.type) };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(archivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module: modulo, exports: modulo.exports, window: ventana, URL, Request, Event,
    localStorage: { setItem: (...args) => almacenados.push(args) } });
  const limpiar = modulo.exports.instalarAvisosDeCambios();
  for (const [url, method] of [['/cobro/api/reservas', 'POST'], ['/admin/api/clientes/1', 'PATCH'], ['/api/ventas', 'DELETE']]) {
    assert.equal(await ventana.fetch(url, { method }), respuesta);
  }
  assert.equal(eventos.length, 3);
  assert.equal(almacenados.length, 3);
  for (const [url, method] of [['/cobro/api/reservas', 'GET'], ['/admin/api/auth/login', 'POST'], ['https://otro.test/api/ventas', 'POST']]) await ventana.fetch(url, { method });
  respuesta = { ok: false };
  await ventana.fetch('/cobro/api/reservas', { method: 'POST' });
  assert.equal(eventos.length, 3);
  respuesta = new Error('Sin conexión');
  await assert.rejects(ventana.fetch('/cobro/api/reservas', { method: 'POST' }), /Sin conexión/);
  assert.equal(eventos.length, 3);
  limpiar();
  assert.equal(ventana.fetch, original);
});