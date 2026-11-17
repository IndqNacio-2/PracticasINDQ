const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const { montarAsistencia } = require('./asistenciaService');

test('código CLI conserva identidad, entrada, salida e historial del checador', async t => {
  const registros = [];
  let reloj = new Date('2026-11-17T12:00:00Z');
  const consultasCliente = [];
  const query = async (sql, valores = []) => {
    if (sql.includes('FROM webcobro.clientes')) {
      if (sql.includes("->>'codigo_usuario'")) return { rows: valores[0] === 'SOC-ANA' ? [{ id: 2 }] : [] };
      consultasCliente.push(valores[0]);
      return { rows: String(valores[0]) === '2' ? [{ id: 2, nombre: 'Ana Pérez', membresia: 'Premium' }] : [] };
    }
    if (sql.includes('CURRENT_TIMESTAMP AS ahora')) return { rows: [{ ahora: reloj }] };
    if (sql.includes('INSERT INTO webcobro.asistencias')) {
      const fila = { id: registros.length + 1, codigo: valores[0], nombre: valores[1], tipo: valores[2], creado_en: reloj };
      registros.push(fila);
      return { rows: [fila] };
    }
    if (sql.includes('FROM webcobro.asistencias')) {
      const filas = registros.filter(r => r.codigo === valores[0]).slice().reverse();
      return { rows: sql.includes('LIMIT 1') && !sql.includes('LIMIT 10') ? filas.slice(0, 1) : filas };
    }
    return { rows: [] };
  };
  const app = express();
  app.use(express.json());
  montarAsistencia(app, { query, connect: async () => ({ query, release() {} }) });
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  t.after(() => new Promise(resolve => servidor.close(resolve)));
  const base = `http://127.0.0.1:${servidor.address().port}/api/asistencia`;
  const marcar = codigo => fetch(`${base}/marcar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo }) });
  let respuesta = await fetch(`${base}/empleado/CLI-2`);
  assert.equal(respuesta.status, 200);
  assert.equal((await respuesta.json()).codigo, 'CLI-2');
  respuesta = await marcar('CLI-2');
  assert.equal(respuesta.status, 200);
  assert.equal((await respuesta.json()).tipo, 'entrada');
  reloj = new Date('2026-11-17T12:02:00Z');
  respuesta = await marcar('2');
  assert.equal(respuesta.status, 200);
  assert.equal((await respuesta.json()).tipo, 'salida');
  const historial = await (await fetch(`${base}/historial/CLI-2`)).json();
  assert.deepEqual(historial.map(r => r.tipo), ['salida', 'entrada']);
  assert.ok(historial.every(r => r.codigo === 'CLI-2'));
  assert.ok(consultasCliente.every(id => String(id) === '2'));
  const conCodigoEditado = await (await fetch(`${base}/historial/SOC-ANA`)).json();
  assert.deepEqual(conCodigoEditado.map(r => r.tipo), ['salida', 'entrada']);
  reloj = new Date('2026-11-17T12:04:00Z');
  respuesta = await marcar('soc-ana');
  assert.equal(respuesta.status, 200);
  assert.equal((await respuesta.json()).codigo, 'CLI-2');
  assert.equal((await fetch(`${base}/empleado/SOC-NOEXISTE`)).status, 404);
  assert.equal((await fetch(`${base}/empleado/CLI-99`)).status, 404);
});

test('usuarios de Administración: identidad estable, alternancia, inactivos y colisiones', async t => {
  const id = 'abcdef123456abcdef123456';
  const interno = `USR-${id.toUpperCase()}`;
  let acceso = 'A101';
  let activo = true;
  let reloj = new Date('2026-11-17T12:00:00Z');
  const registros = [];
  const query = async (sql, valores = []) => {
    if (sql.includes('FROM webcobro.clientes')) return { rows: valores[0] === 'SOC-DUP' ? [{ id: 7 }] : [] };
    if (sql.includes('FROM webcobro.empleados')) return { rows: valores[0] === 'EMP-101' ? [{ nombre: 'Empleado legado' }] : [] };
    if (sql.includes('CURRENT_TIMESTAMP AS ahora')) return { rows: [{ ahora: reloj }] };
    if (sql.includes('INSERT INTO webcobro.asistencias')) {
      const fila = { id: registros.length + 1, codigo: valores[0], nombre: valores[1], tipo: valores[2], creado_en: reloj };
      registros.push(fila); return { rows: [fila] };
    }
    if (sql.includes('FROM webcobro.asistencias')) {
      const filas = registros.filter(r => r.codigo === valores[0]).slice().reverse();
      return { rows: sql.includes('LIMIT 10') ? filas : filas.slice(0, 1) };
    }
    return { rows: [] };
  };
  const app = express(); app.use(express.json());
  app.locals.asistenciaUsuarios = async codigo => activo && [acceso, interno, 'SOC-DUP'].includes(codigo)
    ? { id, nombre: 'Usuario Real', rol: 'entrenador' } : null;
  montarAsistencia(app, { query, connect: async () => ({ query, release() {} }) });
  const servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening');
  t.after(() => new Promise(resolve => servidor.close(resolve)));
  const base = `http://127.0.0.1:${servidor.address().port}/api/asistencia`;
  const marcar = codigo => fetch(`${base}/marcar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo }) });
  const persona = await (await fetch(`${base}/empleado/a101`)).json();
  assert.equal(persona.codigo, interno);
  assert.equal(persona.codigoIngresado, 'A101');
  assert.equal(persona.tipo, 'empleado');
  assert.equal((await (await marcar('A101')).json()).tipo, 'entrada');
  assert.equal((await marcar(interno)).status, 429);
  reloj = new Date('2026-11-17T12:02:00Z');
  acceso = 'A102';
  assert.equal((await fetch(`${base}/empleado/A101`)).status, 404);
  assert.equal((await (await marcar('A102')).json()).tipo, 'salida');
  const historial = await (await fetch(`${base}/historial/A102`)).json();
  assert.deepEqual(historial.map(r => r.tipo), ['salida', 'entrada']);
  assert.ok(historial.every(r => r.codigo === interno));
  assert.equal((await marcar('SOC-DUP')).status, 409);
  assert.equal(registros.length, 2);
  assert.equal((await (await fetch(`${base}/empleado/EMP-101`)).json()).nombre, 'Empleado legado');
  activo = false;
  assert.equal((await marcar(interno)).status, 404);
  assert.equal((await marcar('A102')).status, 404);
  assert.equal(registros.length, 2);
});