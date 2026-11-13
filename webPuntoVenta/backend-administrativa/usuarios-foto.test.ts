import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import usuariosRoutes from './src/routes/usuarios.routes';
import { Usuario } from './src/models/Usuarios/usuarios';
import { validarFoto, MAX_FOTO_CHARS } from './src/lib/foto-usuario';

const foto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=';

test('foto opcional: acepta imágenes y eliminación; rechaza URLs, SVG, tipos y tamaños inválidos', () => {
  for (const valor of ['', null, foto]) assert.equal(validarFoto(valor), null);
  for (const valor of [undefined, {}, 123, 'https://example.com/foto.jpg', 'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/png;base64,aG9sYQ==', 'data:image/jpeg;base64,!!!!', 'a'.repeat(MAX_FOTO_CHARS + 1)]) {
    assert.equal(typeof validarFoto(valor), 'string');
  }
});

test('MongoDB conserva foto sin exponer contraseña y permite usuarios históricos sin foto', async () => {
  const base = { nombre: 'Ana', apellidos: 'Prueba', correo: 'ana@example.test', codigoAcceso: '123', rol: 'vendedor', password: 'hash' };
  const nuevo = new Usuario({ ...base, foto });
  await nuevo.validate();
  assert.equal(nuevo.toJSON().foto, foto);
  assert.equal('password' in nuevo.toJSON(), false);
  const historico = new Usuario(base);
  await historico.validate();
  assert.equal(historico.toJSON().foto, '');
});

test('API: autorización, creación, cambio, eliminación y PATCH ajeno a foto sin conexión a BD', async (t) => {
  const anterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'solo-pruebas-foto';
  t.after(() => { if (anterior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = anterior; });
  let estado: any = { idUsuario: '507f1f77bcf86cd799439011', nombre: 'Ana', foto };
  let escrituras = 0;
  t.mock.method(Usuario, 'findOne', async () => null);
  const documento = () => ({ toJSON: () => { const { password, ...publico } = estado; return publico; } });
  t.mock.method(Usuario, 'create', async (datos: any) => { escrituras++; estado = { ...estado, ...datos }; return documento(); });
  t.mock.method(Usuario, 'findByIdAndUpdate', async (_id: any, cambios: any, opciones: any) => {
    assert.equal(opciones.runValidators, true);
    escrituras++; estado = { ...estado, ...cambios.$set }; return documento();
  });
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use('/api/usuarios', usuariosRoutes);
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => servidor.close(error => error ? reject(error) : resolve())));
  const direccion = servidor.address();
  assert.ok(direccion && typeof direccion !== 'string');
  const token = (rol: string) => jwt.sign({ rol }, process.env.JWT_SECRET!, { subject: 'admin' });
  const enviar = (metodo: string, body: unknown, rol = 'administrador', ruta = '/507f1f77bcf86cd799439011') => fetch(`http://127.0.0.1:${direccion.port}/api/usuarios${ruta}`, {
    method: metodo, headers: { 'Content-Type': 'application/json', ...(rol ? { Authorization: `Bearer ${token(rol)}` } : {}) }, body: JSON.stringify(body),
  });
  assert.equal((await enviar('PATCH', { foto }, '')).status, 401);
  for (const rol of ['vendedor', 'recepcion', 'entrenador']) assert.equal((await enviar('PATCH', { foto }, rol)).status, 403);
  assert.equal((await enviar('POST', { foto: '<svg/>' }, 'administrador', '')).status, 400);
  assert.equal((await enviar('PATCH', { foto: 'https://example.test/foto' })).status, 400);
  assert.equal(escrituras, 0);
  const alta = await enviar('POST', { nombre: 'Ana', apellidos: 'Prueba', correo: 'ana@example.test', rol: 'vendedor', codigoAcceso: '123', password: 'abc', foto }, 'administrador', '');
  assert.equal(alta.status, 201);
  assert.equal('password' in await alta.json(), false);
  assert.notEqual(estado.password, 'abc');
  assert.equal(estado.foto, foto);
  assert.equal((await enviar('PATCH', { nombre: 'Ana editada' })).status, 200);
  assert.equal(estado.foto, foto);
  assert.equal((await enviar('PATCH', { foto: '' })).status, 200);
  assert.equal(estado.foto, '');
  assert.equal((await enviar('PATCH', { foto })).status, 200);
  assert.equal(estado.foto, foto);
});