const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = p => fs.readFileSync(path.join(root, p), 'utf8');
function cargarAuth({ usuario = null, modifiedCount = 1 } = {}) {
  const rutas = {};
  const cambios = [];
  const module = { exports: {} };
  const requireAuth = () => {};
  const router = { post(p, ...handlers) { rutas[p] = handlers; }, get() {} };
  const modelos = { Usuario: {
    findById(id) { assert.equal(id, 'identidad-token'); return { select: async () => usuario }; },
    async updateOne(filtro, cambio) { cambios.push({ filtro, cambio }); return { modifiedCount }; },
  } };
  vm.runInNewContext(ts.transpileModule(source('backend-administrativa/src/routes/auth.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, Buffer, process,
    require(name) {
      if (name === 'express') return { Router: () => router };
      if (name === 'bcryptjs') return { compare: async (p, hash) => p === 'anterior' && hash === 'hash-anterior', hash: async () => 'hash-nuevo' };
      if (name === 'jsonwebtoken') return {};
      if (name === '../middleware/auth') return { requireAuth };
      if (name === '../models/Usuarios/usuarios') return modelos;
      throw Error(name);
    },
  });
  assert.equal(rutas['/cambiar-password'][0], requireAuth);
  return { cambios, async enviar(body) {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await rutas['/cambiar-password'][1]({ body, auth: { id: 'identidad-token' } }, res);
    return res;
  } };
}

test('contraseñas: rechaza cuerpos inválidos, claves cortas, iguales y mayores a 72 bytes', async () => {
  const api = cargarAuth();
  for (const body of [null, {}, { passwordActual: 'a', passwordNueva: 'corta' },
    { passwordActual: 'anterior', passwordNueva: 'anterior' },
    { passwordActual: 'a', passwordNueva: 'á'.repeat(37) }]) {
    assert.equal((await api.enviar(body)).code, 400);
  }
  assert.equal(api.cambios.length, 0);
});

test('contraseñas: rechaza usuarios ausentes, inactivos y contraseña incorrecta', async () => {
  for (const usuario of [null, { estatus: 'inactivo' }, { estatus: 'activo', password: 'otro-hash' }]) {
    const api = cargarAuth({ usuario });
    assert.equal((await api.enviar({ passwordActual: 'anterior', passwordNueva: 'nueva-segura' })).code, 401);
    assert.equal(api.cambios.length, 0);
  }
});

test('contraseñas: actualiza solo la identidad del token sin devolver hash ni confiar en el id del cuerpo', async () => {
  const api = cargarAuth({ usuario: { _id: 'identidad-token', estatus: 'activo', password: 'hash-anterior' } });
  const res = await api.enviar({ id: 'otro-usuario', passwordActual: 'anterior', passwordNueva: 'nueva-segura' });
  assert.equal(res.code, 200);
  assert.equal(api.cambios[0].filtro._id, 'identidad-token');
  assert.equal(api.cambios[0].filtro.password, 'hash-anterior');
  assert.equal(api.cambios[0].cambio.$set.password, 'hash-nuevo');
  assert.doesNotMatch(JSON.stringify(res.data), /hash|nueva-segura/);
});

test('contraseñas: no declara éxito si hubo otro cambio simultáneo', async () => {
  const api = cargarAuth({ usuario: { _id: 'identidad-token', estatus: 'activo', password: 'hash-anterior' }, modifiedCount: 0 });
  assert.equal((await api.enviar({ passwordActual: 'anterior', passwordNueva: 'nueva-segura' })).code, 409);
});

test('API: diferencia configuración ausente de origen relativo y normaliza diagonales', async () => {
  for (const [valor, esperado] of [[undefined, null], ['', '/api/health'], ['/pos/', '/pos/api/health']]) {
    const module = { exports: {} };
    const urls = [];
    const codigo = source('src/services/api.ts').replaceAll('import.meta.env.VITE_API_URL', 'CONFIG');
    vm.runInNewContext(ts.transpileModule(codigo, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
      { module, exports: module.exports, CONFIG: valor, require: () => ({ TOKEN_KEY: 'token' }),
        fetch: async url => { urls.push(url); return { ok: true, json: async () => ({}) }; } });
    if (esperado === null) {
      await assert.rejects(module.exports.getHealth(), /Falta configurar VITE_API_URL/);
      await assert.rejects(module.exports.getProducts(), /Falta configurar VITE_API_URL/);
      assert.equal(urls.length, 0);
    } else {
      await module.exports.getHealth();
      assert.equal(urls[0], esperado);
    }
  }
});