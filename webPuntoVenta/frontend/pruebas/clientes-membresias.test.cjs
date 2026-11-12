const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const carpeta = path.resolve(__dirname, '../src/sections/webAdministrativa/features/clientes');
const modulo = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(carpeta, 'MembresiasCliente.tsx'), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { module: modulo, exports: modulo.exports, require });
const render = compras => renderToStaticMarkup(React.createElement(modulo.exports.MembresiasCliente, { compras }));

test('cliente sin ventas no muestra planes históricos ni vigencia inventada', () => {
  assert.match(render([]), /Sin membresías compradas/);
  assert.match(render(undefined), /Sin membresías compradas/);
  const pagina = fs.readFileSync(path.join(carpeta, 'ClientesPage.tsx'), 'utf8');
  assert.doesNotMatch(pagina, /Premium|Básica|vigencia_hasta|form\.membresia/);
  assert.match(pagina, /MembresiasCliente compras=/);
});

test('muestra todas las compras con nombre, fechas y estado independiente', () => {
  const ahora = new Date();
  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
  const html = render([
    { id: 1, nombre: 'Yoga vendido', fechaInicio: hoy, fechaFin: hoy },
    { id: 2, nombre: 'Pilates anterior', fechaInicio: '2000-01-01', fechaFin: '2000-02-01' },
    { id: 3, nombre: 'Plan futuro', fechaInicio: '9999-01-01', fechaFin: '9999-02-01' },
  ]);
  for (const texto of ['Yoga vendido', 'Pilates anterior', 'Plan futuro', 'Vigente', 'Vencida', 'Próxima a iniciar', `${hoy} al ${hoy}`]) {
    assert.ok(html.includes(texto), texto);
  }
});