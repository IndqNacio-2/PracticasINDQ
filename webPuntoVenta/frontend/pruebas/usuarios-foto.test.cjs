const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const raiz = path.resolve(__dirname, '../src/sections/webAdministrativa');
function cargar(ruta, globals = {}) {
  const modulo = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(raiz, ruta), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module: modulo, exports: modulo.exports, require, ...globals });
  return modulo.exports;
}

test('avatar muestra foto o iniciales sin cambiar dimensiones ni diseño', () => {
  const { UsuarioAvatar } = cargar('components/UsuarioAvatar.tsx');
  const render = props => renderToStaticMarkup(React.createElement(UsuarioAvatar, props));
  assert.match(render({ nombre: 'Ana', apellidos: 'Prueba' }), /AP/);
  assert.match(render({ foto: 'data:image/jpeg;base64,/9j/', nombre: 'Ana', className: 'w-8 h-8 rounded-full' }), /object-cover/);
  assert.match(render({}), /\?/);
});

test('selector de foto tiene botón visible con cámara y abre el input de archivos', () => {
  const pagina = fs.readFileSync(path.join(raiz, 'features/usuarios/UsuariosPage.tsx'), 'utf8');
  assert.match(pagina, /const inputFoto = useRef<HTMLInputElement>\(null\)/);
  assert.match(pagina, /<input ref=\{inputFoto\}[\s\S]*?className="hidden"/);
  assert.match(pagina, /<button type="button" disabled=\{saving \|\| procesandoFoto\} className="rx-btn rx-btn--outline mt-3"\s+onClick=\{\(\) => inputFoto.current\?\.click\(\)\}>/);
  assert.match(pagina, /<Icon name="photo_camera" size=\{20\} \/>/);
  assert.match(pagina, /form.foto \? 'Cambiar foto' : 'Agregar foto'/);
});

test('foto se reduce a 320 px y siempre libera URL temporal', async () => {
  let revocadas = 0;
  let canvas;
  class Imagen { naturalWidth = 640; naturalHeight = 480; set src(_valor) { this.onload(); } }
  const { reducirFoto } = cargar('lib/fotoUsuario.ts', {
    URL: { createObjectURL: () => 'blob:prueba', revokeObjectURL: () => revocadas++ },
    Image: Imagen,
    document: { createElement: () => (canvas = { getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,/9j/' }) },
  });
  assert.equal(await reducirFoto({ type: 'image/png', size: 1024 }), 'data:image/jpeg;base64,/9j/');
  assert.equal(canvas.width, 320);
  assert.equal(canvas.height, 240);
  assert.equal(revocadas, 1);
  await assert.rejects(() => reducirFoto({ type: 'image/svg+xml', size: 10 }), /JPG/);
  await assert.rejects(() => reducirFoto({ type: 'image/jpeg', size: 11 * 1024 * 1024 }), /10 MB/);
});

test('no se acepta imagen corrupta y se libera recurso al fallar', async () => {
  let revocadas = 0;
  class Imagen { set src(_valor) { this.onerror(); } }
  const { reducirFoto } = cargar('lib/fotoUsuario.ts', {
    URL: { createObjectURL: () => 'blob:prueba', revokeObjectURL: () => revocadas++ }, Image: Imagen,
  });
  await assert.rejects(() => reducirFoto({ type: 'image/png', size: 10 }), /leer/);
  assert.equal(revocadas, 1);
});