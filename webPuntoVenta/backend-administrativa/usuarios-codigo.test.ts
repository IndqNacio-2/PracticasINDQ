import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Usuario } from './src/models/Usuarios/usuarios';
import rutas from './src/routes/usuarios.routes';
import { PREFIJOS_USUARIO, numeroDeCodigo, validarCodigoUsuario } from '../shared/codigoUsuario';

test('prefijos por rol, números normalizados y formato de checador', () => {
  for (const [rol, prefijo] of Object.entries(PREFIJOS_USUARIO)) {
    assert.equal(validarCodigoUsuario(`${prefijo}00123`, rol), null);
    for (const codigo of [prefijo, `${prefijo}-123`, `${prefijo}ABC`, 'CLI-123', `${prefijo}${'1'.repeat(28)}`]) {
      assert.ok(validarCodigoUsuario(codigo, rol));
    }
  }
  assert.equal(numeroDeCodigo('VEN00123'), '123');
  assert.equal(numeroDeCodigo('A123'), '123');
  assert.equal(numeroDeCodigo('EMP-123'), '123');
  assert.equal(numeroDeCodigo('000'), '0');
  assert.equal(numeroDeCodigo('123'), '123');
  assert.equal(numeroDeCodigo('SOC-ANA'), null);
});

test('rutas: duplicados entre roles, inactivos, exclusión, edición antigua y carrera de índice', async t => {
  const id = 'abcdef123456abcdef123456';
  const otroId = '123456abcdef123456abcdef';
  const originales = { exists: Usuario.exists, init: Usuario.init, create: Usuario.create,
    findById: Usuario.findById, findByIdAndUpdate: Usuario.findByIdAndUpdate };
  const secreto = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'pruebas-codigo-usuario';
  t.after(() => { Object.assign(Usuario, originales); if (secreto === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secreto; });
  let escrituras = 0;
  let duplicado = false;
  let carrera = false;
  let datos: any;
  const consultas: any[] = [];
  Object.assign(Usuario, {
    init: async () => Usuario,
    exists: async (filtro: any) => { consultas.push(filtro); return duplicado ? { _id: otroId } : null; },
    findById: () => ({ select: async () => ({ codigoAcceso: 'A101', rol: 'administrador' }) }),
    create: async (d: any) => {
      if (carrera) throw Object.assign(new Error('duplicate'), { code: 11000, keyPattern: { numeroAcceso: 1 } });
      escrituras++; datos = d; return { toJSON: () => ({ codigoAcceso: d.codigoAcceso }) };
    },
    findByIdAndUpdate: async (_id: string, cambio: any) => { escrituras++; datos = cambio.$set; return { toJSON: () => ({ codigoAcceso: datos.codigoAcceso }) }; },
  });
  const app = express(); app.use(express.json()); app.use('/usuarios', rutas);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const token = jwt.sign({ rol: 'administrador' }, process.env.JWT_SECRET!, { subject: id });
  const enviar = (ruta: string, method = 'GET', body?: any, auth = true) => fetch(`http://127.0.0.1:${(server.address() as any).port}/usuarios${ruta}`, {
    method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const nuevo = { nombre: 'Ana', apellidos: 'Pérez', correo: 'ana@example.com', rol: 'vendedor', password: 'abc', codigoAcceso: 'VEN00123' };
  assert.equal((await enviar('/codigo-disponible?codigo=VEN123', 'GET', undefined, false)).status, 401);
  assert.equal((await enviar('', 'POST', { ...nuevo, codigoAcceso: 'ADM123' })).status, 400);
  duplicado = true;
  assert.equal((await enviar('', 'POST', nuevo)).status, 409);
  assert.equal(escrituras, 0);
  assert.equal((await (await enviar('/codigo-disponible?codigo=ADM00123')).json()).disponible, false);
  assert.equal(consultas.at(-1).$or[1].codigoAcceso.$regex, '^(?:[A-Z]+-?)?0*123$');
  assert.equal(consultas.at(-1).estatus, undefined, 'incluye inactivos');
  duplicado = false;
  assert.equal((await enviar('', 'POST', nuevo)).status, 201);
  assert.equal(datos.numeroAcceso, '123');
  assert.equal(datos.codigoAcceso, 'VEN00123');
  assert.equal((await enviar(`/${id}`, 'PATCH', { codigoAcceso: 'A101', nombre: 'Ana', rol: 'administrador' })).status, 200);
  assert.equal(datos.numeroAcceso, undefined, 'no transforma código antiguo');
  assert.equal((await enviar(`/${id}`, 'PATCH', { codigoAcceso: 'ADM00123' })).status, 200);
  assert.equal(datos.numeroAcceso, '123');
  assert.deepEqual(consultas.at(-1)._id, { $ne: id });
  duplicado = true;
  const antes = escrituras;
  assert.equal((await enviar(`/${id}`, 'PATCH', { codigoAcceso: 'ADM123' })).status, 409);
  assert.equal(escrituras, antes);
  duplicado = false; carrera = true;
  const respuesta = await enviar('', 'POST', nuevo);
  assert.equal(respuesta.status, 409);
  assert.match((await respuesta.json()).error, /número/);
});