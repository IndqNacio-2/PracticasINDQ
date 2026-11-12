import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { once } from 'node:events';
import membresiasRoutes from './src/routes/membresia.routes';
import { CATALOGO_INICIAL, validarMembresia, sembrarMembresias } from './src/lib/membresia.lib';
import { Membresia } from './src/models/Membresia/membresia.model';
import { Clase } from './src/models/Clases/clases';

const planModular = {
  nombre: 'Plan personalizado', clasesIds: ['507f1f77bcf86cd799439012'], accesos: ['Clase de prueba'],
  opciones: [{ id: 'mensual', entradas: 12, duracion: 1, unidadDuracion: 'meses', distribucion: 'compartida', costo: 500 }],
};

test('planes modulares: clases por ID, meses reales, precio y distribución', () => {
  const valido = validarMembresia(planModular);
  assert.equal(valido.ok, true);
  if (valido.ok) {
    assert.equal(valido.valor.opciones[0].unidadDuracion, 'meses');
    assert.equal(valido.valor.opciones[0].vigenciaDias, undefined);
  }
  const opcion = planModular.opciones[0];
  for (const cambios of [{ clasesIds: [] }, { clasesIds: ['nombre'] },
    { opciones: [{ ...opcion, duracion: 0 }] }, { opciones: [{ ...opcion, costo: null }] },
    { opciones: [{ ...opcion, unidadDuracion: 'semanas' }] },
    { opciones: [{ ...opcion, distribucion: 'por_clase', entradasPorClase: {} }] }]) {
    assert.equal(validarMembresia({ ...planModular, ...cambios }).ok, false);
  }
  assert.equal(validarMembresia({ ...planModular, opciones: [{ ...opcion, distribucion: 'por_clase', entradasPorClase: { [planModular.clasesIds[0]]: 12 } }] }).ok, true);
});

test('esquema conserva duración y cantidades por clase al serializar sin BD', async () => {
  const entrada = validarMembresia({ ...planModular, opciones: [{ ...planModular.opciones[0], distribucion: 'por_clase', entradasPorClase: { [planModular.clasesIds[0]]: 12 } }] });
  assert.equal(entrada.ok, true);
  if (!entrada.ok) return;
  const documento = new Membresia({ ...entrada.valor, nombreClave: 'plan personalizado' });
  await documento.validate();
  const json = JSON.parse(JSON.stringify(documento));
  assert.deepEqual(json.clasesIds, planModular.clasesIds);
  assert.deepEqual(json.opciones[0].entradasPorClase, { [planModular.clasesIds[0]]: 12 });
  assert.equal(json.opciones[0].duracion, 1);
  assert.equal(json.opciones[0].vigenciaDias, undefined);
});

test('catálogo de Alexis y validaciones sin conexión a datos', () => {
  assert.equal(CATALOGO_INICIAL.length, 5);
  for (const datos of CATALOGO_INICIAL) assert.equal(validarMembresia(datos).ok, true);
  const base = CATALOGO_INICIAL[0];
  for (const datos of [null, [], {}, { ...base, nombre: '' }, { ...base, accesos: [] },
    { ...base, opciones: [null] }, { ...base, opciones: [{ entradas: 0, vigenciaDias: 30, costo: 1 }] },
    { ...base, opciones: [{ entradas: 1, vigenciaDias: 0, costo: 1 }] },
    { ...base, opciones: [{ entradas: 1, vigenciaDias: 30, costo: -1 }] },
    { ...base, opciones: [base.opciones[0], base.opciones[0]] },
    { ...base, complementos: { descuento: { porcentaje: 101 } } },
    { ...base, complementos: { locker: 'false' } },
    { ...base, complementos: [] },
    { ...base, kit: [] },
    { ...base, kit: { productos: [], cortesias: [] } }]) {
    assert.equal(validarMembresia(datos).ok, false);
  }
  const resultado = validarMembresia({ ...base, accesos: [' Sala ', 'sala'] });
  assert.equal(resultado.ok, true);
  if (resultado.ok) assert.deepEqual(resultado.valor.accesos, ['Sala']);
});

test('seed usa exclusivamente inserción de faltantes y conserva ediciones', async (t) => {
  const almacen = new Map<string, unknown>();
  t.mock.method(Membresia, 'updateOne', async (filtro: any, cambio: any, opciones: any) => {
    assert.deepEqual(Object.keys(cambio), ['$setOnInsert']);
    assert.equal(opciones.upsert, true);
    if (almacen.has(filtro.nombreClave)) return { upsertedCount: 0 };
    almacen.set(filtro.nombreClave, cambio.$setOnInsert);
    return { upsertedCount: 1 };
  });
  assert.equal(await sembrarMembresias(), 5);
  almacen.set('open gym', { nombre: 'Edición existente', costo: 999 });
  assert.equal(await sembrarMembresias(), 0);
  assert.deepEqual(almacen.get('open gym'), { nombre: 'Edición existente', costo: 999 });
});

test('rutas: sesión, roles, listado y rechazos antes de consultar datos', async (t) => {
  const secretoAnterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'secreto-exclusivo-pruebas-no-produccion';
  t.after(() => { if (secretoAnterior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secretoAnterior; });
  t.mock.method(Membresia, 'find', () => ({ sort: async () => [] }));
  const app = express();
  app.use(express.json());
  app.use('/api/membresias', membresiasRoutes);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const direccion = server.address() as { port: number };
  const url = `http://127.0.0.1:${direccion.port}/api/membresias`;
  const headers = (rol: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ rol }, process.env.JWT_SECRET!, { subject: '507f1f77bcf86cd799439011' })}` });
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: headers('vendedor') })).status, 403);
  const lista = await fetch(url, { headers: headers('recepcion') });
  assert.equal(lista.status, 200);
  assert.deepEqual(await lista.json(), []);
  assert.equal((await fetch(url, { method: 'POST', headers: headers('recepcion'), body: '{}' })).status, 403);
  assert.equal((await fetch(url, { method: 'POST', headers: headers('administrador'), body: '{}' })).status, 400);
  assert.equal((await fetch(`${url}/invalido`, { method: 'PATCH', headers: headers('administrador'), body: '{}' })).status, 400);
});

test('CRUD HTTP con persistencia simulada: crear, editar, baja lógica y duplicado', async (t) => {
  t.mock.method(Clase, 'countDocuments', async () => 1);
  const secretoAnterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'secreto-exclusivo-pruebas-crud';
  t.after(() => { if (secretoAnterior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secretoAnterior; });
  const id = '507f1f77bcf86cd799439011';
  let datos: any = null;
  let duplicado = false;
  const documento = {
    toJSON: () => ({ ...datos, idMembresia: id }),
    set: (cambios: any) => { datos = { ...datos, ...cambios }; },
    save: async () => documento,
  };
  t.mock.method(Membresia, 'exists', async () => duplicado);
  t.mock.method(Membresia, 'create', async (entrada: any) => {
    datos = entrada;
    return { ...entrada, idMembresia: id };
  });
  t.mock.method(Membresia, 'findById', async () => datos ? documento : null);
  const app = express();
  app.use(express.json());
  app.use('/api/membresias', membresiasRoutes);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/membresias`;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ rol: 'administrador' }, process.env.JWT_SECRET!, { subject: id })}` };
  assert.equal((await fetch(url, { method: 'POST', headers, body: JSON.stringify(CATALOGO_INICIAL[0]) })).status, 400);
  const crear = await fetch(url, { method: 'POST', headers, body: JSON.stringify(planModular) });
  assert.equal(crear.status, 201);
  assert.equal((await crear.json()).idMembresia, id);
  t.mock.method(Clase, 'countDocuments', async () => 0);
  assert.equal((await fetch(url, { method: 'POST', headers, body: JSON.stringify(planModular) })).status, 400);
  t.mock.method(Clase, 'countDocuments', async () => 1);
  assert.equal((await fetch(`${url}/${id}`, { headers })).status, 200);
  const opcionesOriginales = structuredClone(datos.opciones);
  const baja = await fetch(`${url}/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ estatus: 'inactivo' }) });
  assert.equal(baja.status, 200);
  assert.equal((await baja.json()).estatus, 'inactivo');
  assert.deepEqual(datos.opciones, opcionesOriginales);
  const editar = await fetch(`${url}/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ nombre: 'Nombre actualizado' }) });
  assert.equal(editar.status, 200);
  assert.equal((await editar.json()).nombre, 'Nombre actualizado');
  duplicado = true;
  assert.equal((await fetch(url, { method: 'POST', headers, body: JSON.stringify(planModular) })).status, 409);
  duplicado = false;
  const antes = structuredClone(datos);
  assert.equal((await fetch(`${url}/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ opciones: [] }) })).status, 400);
  assert.deepEqual(datos, antes);
  datos = null;
  assert.equal((await fetch(`${url}/${id}`, { headers })).status, 404);
});