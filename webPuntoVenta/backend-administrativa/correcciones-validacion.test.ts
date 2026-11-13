import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import clasesRoutes from './src/routes/clases.routes';
import clientesRoutes from './src/routes/clientes.routes';
import reservasRoutes from './src/routes/reservaciones.routes';
import horariosRoutes from './src/routes/horarios.routes';
import { Clase } from './src/models/Clases/clases';
import { Cliente } from './src/models/Clientes/cliente';
import { Horario } from './src/models/Horarios/horarios';
import { Usuario } from './src/models/Usuarios/usuarios';
import { Reservacion } from './src/models/Reservaciones/reservacion';
import { validarClase } from './src/lib/validacion-clases';

const id = '507f1f77bcf86cd799439011';
async function servidor(t: any) {
  const app = express(); app.use(express.json());
  app.use('/clases', clasesRoutes); app.use('/clientes', clientesRoutes);
  app.use('/reservaciones', reservasRoutes); app.use('/horarios', horariosRoutes);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return (ruta: string, method = 'GET', body?: unknown) => fetch(`http://127.0.0.1:${address.port}${ruta}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('clases: reglas y esquema rechazan espacios, capacidades inválidas y precios negativos', async () => {
  for (const cambio of [{ nombre: '' }, { nombre: '  ' }, { capacidad: -4 }, { capacidad: 0 }, { capacidad: 1.5 }, { precio: -1 }, { precio: Infinity }]) {
    const datos = { nombre: 'Yoga', capacidad: 10, precio: 100, ...cambio };
    assert.ok(validarClase(datos)); await assert.rejects(new Clase(datos).validate());
  }
  assert.ok(validarClase({ capacidad: null }, true));
  assert.ok(validarClase({ $set: { capacidad: -1 } }, true));
  assert.equal(validarClase({ estatus: 'inactivo' }, true), null);
  await new Clase({ nombre: ' Yoga ', capacidad: 1, precio: 0 }).validate();
  for (const capacidadTotal of [0, -1, 1.5]) {
    const horario = new Horario({ idClase: id, nombreClase: 'Yoga', entrenadorId: id, nombreEntrenador: 'Ana',
      fecha: '2099-01-01', horaInicio: '10:00', horaFin: '11:00', capacidadTotal, capacidadDisponible: 0, salon: 'A' });
    await assert.rejects(horario.validate());
  }
});

test('API clases: creación, edición parcial y validadores de actualización sin BD', async t => {
  let escrituras = 0;
  t.mock.method(Clase, 'create', async (datos: any) => { escrituras++; return datos; });
  t.mock.method(Clase, 'findByIdAndUpdate', async (_id: any, datos: any, opciones: any) => {
    assert.equal(opciones.runValidators, true); escrituras++; return datos;
  });
  const enviar = await servidor(t);
  for (const cambio of [{ nombre: '' }, { nombre: ' ' }, { capacidad: -1 }, { capacidad: 0 }, { capacidad: 1.2 }, { precio: -1 }, { $inc: { capacidad: -10 } }]) {
    assert.equal((await enviar('/clases', 'POST', { nombre: 'Yoga', capacidad: 10, ...cambio })).status, 400);
    assert.equal((await enviar(`/clases/${id}`, 'PATCH', cambio)).status, 400);
  }
  assert.equal(escrituras, 0);
  const alta = await enviar('/clases', 'POST', { nombre: ' Yoga ', capacidad: 1, precio: 0 });
  assert.equal(alta.status, 201); assert.equal((await alta.json()).nombre, 'Yoga');
  assert.equal((await enviar(`/clases/${id}`, 'PATCH', { estatus: 'inactivo' })).status, 200);
});

test('clientes históricos: correo validado en POST/PATCH/esquema y DELETE es baja lógica', async t => {
  let bajas = 0;
  t.mock.method(Cliente, 'findByIdAndUpdate', async (_id: any, datos: any) => { assert.equal(datos.estatus, 'inactivo'); bajas++; return { idUsuario: id }; });
  t.mock.method(Cliente, 'findByIdAndDelete', async () => { throw new Error('No debe borrar'); });
  const enviar = await servidor(t);
  for (const correo of ['no-es-correo', 'a@b', 'a b@correo.test', {}, null]) {
    assert.equal((await enviar('/clientes', 'POST', { nombre: 'Ana', correo })).status, 400);
    assert.equal((await enviar(`/clientes/${id}`, 'PATCH', { correo })).status, 400);
  }
  await assert.rejects(new Cliente({ nombre: 'Ana', apellidos: 'Prueba', correo: 'invalido', codigoAcceso: 'T' }).validate());
  assert.equal((await enviar(`/clientes/${id}`, 'DELETE')).status, 204); assert.equal(bajas, 1);
});

test('horarios: comprueba existencia y actividad de clase y entrenador sin exponer datos personales', async t => {
  let entrenador: any = { rol: 'entrenador', estatus: 'activo' };
  let clase: any = { estatus: 'activo' };
  t.mock.method(Horario, 'findById', async () => ({ idClase: id, entrenadorId: id }));
  t.mock.method(Clase, 'findById', async () => clase);
  t.mock.method(Usuario, 'findById', async () => entrenador);
  const enviar = await servidor(t);
  assert.equal((await enviar(`/horarios/${id}/validacion`)).status, 200);
  for (const estado of [null, { rol: 'vendedor', estatus: 'activo' }, { rol: 'entrenador', estatus: 'inactivo' }]) {
    entrenador = estado; assert.equal((await enviar(`/horarios/${id}/validacion`)).status, 409);
  }
  entrenador = { rol: 'entrenador', estatus: 'activo' }; clase = null;
  assert.equal((await enviar(`/horarios/${id}/validacion`)).status, 409);
});

test('reservas administrativas delegan creación y reagenda a Recepción, sin escrituras MongoDB', async t => {
  t.mock.method(Reservacion, 'create', async () => { throw new Error('No escribir MongoDB'); });
  t.mock.method(Reservacion, 'findByIdAndUpdate', async () => { throw new Error('No escribir MongoDB'); });
  t.mock.method(Horario, 'findById', async () => ({ fecha: '2099-01-01', horaInicio: '10:00', nombreClase: 'Yoga' }));
  const original = globalThis.fetch;
  const llamadas: any[] = [];
  t.mock.method(globalThis, 'fetch', async (url: any, opciones: any) => {
    if (String(url).includes('/cobro/api')) {
      llamadas.push({ url: String(url), datos: JSON.parse(opciones.body) });
      return Response.json({ error: 'Esta reservación ya se reagendó una vez.' }, { status: 409 });
    }
    return original(url, opciones);
  });
  const enviar = await servidor(t);
  assert.equal((await enviar('/reservaciones', 'POST', { idCliente: id, idHorario: id, fechaReservacion: '2099-01-01' })).status, 400);
  assert.equal((await enviar('/reservaciones', 'POST', { idCliente: 1, idHorario: id, fechaReservacion: '2000-01-01' })).status, 409);
  assert.equal((await enviar('/reservaciones', 'POST', { idCliente: 1, idHorario: id, fechaReservacion: '2099-01-01' })).status, 409);
  assert.equal(llamadas[0].datos.class, 'Yoga'); assert.equal(llamadas[0].datos.clienteId, 1);
  assert.equal((await enviar('/reservaciones/1', 'PATCH', { idHorario: id, fechaReservacion: '2099-01-01' })).status, 409);
  assert.ok(llamadas[1].url.endsWith('/reservas/1/reagendar'));
  assert.equal((await enviar('/reservaciones/1/reagendar', 'POST', { horarioId: id, fecha: '2099-01-01' })).status, 409);
  assert.equal((await enviar(`/reservaciones/${id}`, 'PATCH', { idHorario: id })).status, 409);
  assert.equal((await enviar('/reservaciones/1', 'PATCH', { reagendada: false })).status, 400);
});