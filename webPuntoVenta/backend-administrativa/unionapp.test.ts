import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { once } from 'node:events';
import productos from './src/routes/productos.routes';
import movimientos from './src/routes/movimientos.routes';
import { pool } from './src/lib/post';
import { leerFiltros } from './src/services/reportes.service';

test('UnionApp: inventario real compartido, permisos y movimientos transaccionales sin BD', async (t) => {
  const anterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'pruebas-unionapp';
  t.after(() => { if (anterior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = anterior; });
  const fila = { id: 1, code: 'P1', name: 'Producto real', category: 'Bebidas', price: 20, stock: 4, status: 'active' };
  const consultas: string[] = [];
  t.mock.method(pool, 'query', async (sql: string) => {
    consultas.push(sql);
    return { rows: sql.includes('ORDER BY name') ? [fila] : [], rowCount: 1 };
  });
  const transaccion: string[] = [];
  let liberada = false;
  t.mock.method(pool, 'connect', async () => ({
    query: async (sql: string) => {
      transaccion.push(sql);
      return { rows: sql.startsWith('UPDATE') ? [fila] : sql.startsWith('INSERT')
        ? [{ id: 2, product_id: 1, type: 'entrada', quantity: 2, reason: '', created_at: new Date() }] : [] };
    },
    release: () => { liberada = true; },
  }));
  const app = express();
  app.use(express.json());
  app.use('/productos', productos);
  app.use('/movimientos', movimientos);
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => servidor.close(e => e ? reject(e) : resolve())));
  const direccion = servidor.address();
  assert.ok(direccion && typeof direccion !== 'string');
  const pedir = (ruta: string, rol?: string, body?: unknown) => fetch(`http://127.0.0.1:${direccion.port}${ruta}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(rol ? { Authorization: `Bearer ${jwt.sign({ rol }, process.env.JWT_SECRET!, { subject: 'prueba' })}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal((await pedir('/productos')).status, 401);
  assert.equal((await pedir('/productos', 'recepcion')).status, 403);
  for (const rol of ['administrador', 'vendedor']) {
    const r = await pedir('/productos', rol);
    assert.equal(r.status, 200);
    assert.equal((await r.json())[0].idProducto, '1');
  }
  assert.ok(consultas.every(sql => sql.includes('webpontoventa.products')));
  assert.equal((await pedir('/movimientos', 'administrador', { idProducto: 1, tipo: 'entrada', cantidad: 2 })).status, 201);
  assert.equal(transaccion[0], 'BEGIN');
  assert.ok(transaccion.some(sql => sql.includes('stock + $1 >= 0')));
  assert.equal(transaccion.at(-1), 'COMMIT');
  assert.equal(liberada, true);
});

test('UnionApp: reportes rechazan fechas y horas inválidas antes de consultar PostgreSQL', () => {
  assert.equal(leerFiltros({ desde: '2026-11-01', hasta: '2026-11-13' }).ok, true);
  for (const filtro of [{ desde: 'invalida' }, { desde: '2026-11-13', hasta: '2026-11-01' }, { horaDesde: '30' }]) {
    assert.equal(leerFiltros(filtro).ok, false);
  }
});