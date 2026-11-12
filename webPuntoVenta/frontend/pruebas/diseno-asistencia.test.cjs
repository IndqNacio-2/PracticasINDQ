const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'src/sections/webCobro/pages/asistencia.jsx');
const source = fs.readFileSync(file, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText;

function preparar({ codigo = '', empleado = null, historial = [], resultado = null, marcando = false, fetchImpl } = {}) {
  const valores = [new Date('2026-11-05T18:00:00Z'), codigo, resultado, historial, empleado, false, marcando];
  const cambios = [];
  const efectos = [];
  const referencia = { current: 1 };
  let indice = 0;
  const modulo = { exports: {} };
  const reactSimulado = { ...React,
    useState() { const i = indice++; return [valores[i], valor => cambios.push({ indice: i, valor })]; },
    useEffect(efecto) { efectos.push(efecto); },
    useRef() { return referencia; },
  };
  vm.runInNewContext(compiled, {
    module: modulo, exports: modulo.exports,
    require(nombre) {
      if (nombre === 'react') return reactSimulado;
      if (nombre === 'react/jsx-runtime') return require(nombre);
      if (nombre.endsWith('/BrandLogo')) return { default: () => React.createElement('img', { alt: 'NUUCLEO', src: '/branding/nuucleo-symbol.png' }) };
      if (nombre.endsWith('/MaterialIcon')) return { default: ({ name }) => React.createElement('span', { 'aria-hidden': true }, name) };
      throw Error(`Importacion inesperada: ${nombre}`);
    },
    fetch: fetchImpl ?? (() => { throw Error('No se permiten llamadas reales'); }),
    console, setTimeout, clearTimeout, setInterval, clearInterval,
  }, { filename: file });
  const arbol = modulo.exports.default();
  function nodos(elemento, predicado) {
    if (!elemento || typeof elemento !== 'object') return [];
    const hijos = React.Children.toArray(elemento.props?.children);
    return [...(predicado(elemento) ? [elemento] : []), ...hijos.flatMap(hijo => nodos(hijo, predicado))];
  }
  return { arbol, cambios, referencia, efectos,
    html: () => renderToStaticMarkup(arbol),
    botonMarcar: () => nodos(arbol, n => n.type === 'button' && n.props.onClick?.name === 'marcar')[0],
    botones: () => nodos(arbol, n => n.type === 'button'),
  };
}

test('kiosco: diseño compartido, logo local y buscador accesible', () => {
  const pagina = preparar();
  const html = pagina.html();
  assert.match(html, /class="rx-kiosk"/);
  assert.match(html, /rx-kiosk-clock/);
  assert.match(html, /aria-label="Código de empleado o ID del socio"/);
  assert.match(html, /\/branding\/nuucleo-symbol.png/);
  assert.equal(pagina.botonMarcar(), undefined);
});

test('historial diferencia falta automatica de entrada fisica', () => {
  const pagina = preparar({ codigo: 'EMP-101', empleado: { codigo: 'EMP-101', nombre: 'Carlos Estrada', siguienteTipo: 'entrada' },
    historial: [{ _id: 1, tipo: 'entrada', automatica: true, estado: 'inasistencia', fecha: '2026-11-05T08:00:00Z' }] });
  const html = pagina.html();
  assert.match(html, /Sin entrada registrada/);
  assert.match(html, /person_off/);
  assert.match(html, /Inasistencia/);
  assert.match(html, /Marcar entrada/);
  assert.equal(pagina.botonMarcar().props.disabled, false);
});

test('no permite marcar otra persona ni duplicar envio mientras esta en curso', () => {
  assert.equal(preparar({ codigo: 'CLI-2', empleado: { codigo: 'CLI-1', nombre: 'Socio' } }).botonMarcar(), undefined);
  assert.equal(preparar({ codigo: '1', empleado: { codigo: 'CLI-1', nombre: 'Socio' }, marcando: true }).botonMarcar().props.disabled, true);
});

test('respuesta atrasada de marcacion no reemplaza otra persona ni historial', async () => {
  let responder;
  const pagina = preparar({ codigo: 'EMP-101', empleado: { codigo: 'EMP-101', nombre: 'Carlos', siguienteTipo: 'entrada' },
    fetchImpl: () => new Promise(resolve => { responder = resolve; }) });
  const envio = pagina.botonMarcar().props.onClick();
  pagina.referencia.current += 1;
  responder({ ok: true, json: async () => ({ tipo: 'entrada', estado: 'puntual' }) });
  await envio;
  assert.equal(pagina.cambios.filter(c => [3, 4].includes(c.indice)).length, 0);
  assert.equal(pagina.cambios.filter(c => c.indice === 2 && c.valor !== null).length, 0);
});

test('marca conserva endpoint y codigo normalizado; refresca persona e historial', async () => {
  const llamadas = [];
  const persona = { codigo: 'CLI-3', nombre: 'Socio', siguienteTipo: 'salida' };
  const pagina = preparar({ codigo: '3', empleado: { ...persona, siguienteTipo: 'entrada' }, fetchImpl: async (url, opciones) => {
    llamadas.push({ url, opciones });
    return { ok: true, json: async () => url.endsWith('/marcar') ? { tipo: 'entrada' }
      : url.includes('/historial/') ? { registros: [{ _id: 1, tipo: 'entrada' }] } : persona };
  } });
  await pagina.botonMarcar().props.onClick();
  assert.equal(llamadas.length, 3);
  assert.equal(llamadas[0].url, '/cobro/api/asistencia/marcar');
  assert.equal(llamadas[0].opciones.method, 'POST');
  assert.equal(JSON.parse(llamadas[0].opciones.body).codigo, 'CLI-3');
  assert.ok(pagina.cambios.some(c => c.indice === 4 && c.valor.codigo === 'CLI-3'));
  assert.ok(pagina.cambios.some(c => c.indice === 3 && c.valor.length === 1));
});

test('errores y alertas usan roles accesibles y no confirman marcaciones', async () => {
  const pagina = preparar({ codigo: 'CLI-3', empleado: { codigo: 'CLI-3', nombre: 'Socio' },
    resultado: { exitoso: false, msg: 'Codigo no encontrado' },
    fetchImpl: async () => ({ ok: false, json: async () => ({ error: 'Registro rechazado' }) }) });
  assert.match(pagina.html(), /role="alert"/);
  await pagina.botonMarcar().props.onClick();
  assert.ok(pagina.cambios.some(c => c.indice === 2 && c.valor?.exitoso === false && c.valor.msg === 'Registro rechazado'));
});