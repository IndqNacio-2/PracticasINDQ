const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

test('marca completa y símbolo conservan imágenes, proporciones y texto accesible', () => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/components/BrandLogo.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require });
  for (const [variant, width, name] of [['full', 1507, 'logo'], ['symbol', 453, 'symbol']]) {
    const img = exports.default({ variant });
    assert.equal(img.props.src, `/branding/nuucleo-${name}.png`);
    assert.equal(img.props.width, width); assert.equal(img.props.height, 322);
    assert.match(img.props.alt, /NUUCLEO/); assert.match(img.props.className, /rx-brand-image/);
    const png = fs.readFileSync(path.join(root, 'public', img.props.src));
    assert.equal(png.readUInt32BE(16), width); assert.equal(png.readUInt32BE(20), 322);
  }
  const css = fs.readFileSync(path.join(root, 'src/styles/pos-ui.css'), 'utf8');
  assert.match(css, /\.rx-brand-image \{ background-color: transparent; \}/);
  assert.doesNotMatch(css, /\.rx-brand-image\s*\{[^}]*background(?:-color)?\s*:\s*#000\b/);
});