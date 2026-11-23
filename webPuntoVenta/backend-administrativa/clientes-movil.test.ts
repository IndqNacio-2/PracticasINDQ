import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { Pool } from 'pg';
import { normalizarCliente, perfilCompartido, validarPassword } from './src/lib/cliente-compartido';
import { crearRutasClientesMovil } from './src/routes/clientes-movil.routes';

test('reglas compartidas: acentos, nombre completo, correo, teléfono y salud parcial', () => {
    assert.deepEqual(normalizarCliente({ nombre: ' María ', apellidos: 'Pérez', correo: ' ANA@EJEMPLO.COM ', telefono: '1234567890', perfilSalud: { lesiones: [' Rodilla ', 'rodilla'] } }), {
        nombre: 'María Pérez', correo: 'ana@ejemplo.com', telefono: '1234567890', lesiones: ['Rodilla'],
    });
    assert.deepEqual(normalizarCliente({ telefono: '' }, true), { telefono: '' });
    assert.deepEqual(normalizarCliente({ lesiones: [] }, true), { lesiones: [] });
    for (const b of [{ nombre: 'Ana2' }, { nombre: 'Al' }, { correo: '' }, { correo: 'ana@@ejemplo.com' }, { telefono: '+52123' }, { telefono: '12345678901' }, { codigoAcceso: 'CLI-9' }, { id: 20 }, { activo: true }, { membresia: 'Premium' }, { rol: 'administrador' }, { $set: {} }, { perfilSalud: { peso: 50 } }, { lesiones: [null] }]) {
        assert.throws(() => normalizarCliente(b, true));
    }
    assert.throws(() => normalizarCliente(null, true));
    assert.throws(() => normalizarCliente({ nombre: 'Ana' }));
});

test('contraseñas: confirmación y límite UTF-8 de bcrypt', () => {
    assert.equal(validarPassword('contraseña segura', 'contraseña segura'), 'contraseña segura');
    for (const [p, c] of [['corta', 'corta'], ['contraseña', 'otra'], ['á'.repeat(37), 'á'.repeat(37)]]) assert.throws(() => validarPassword(p, c));
});

test('perfil conserva identidad y código del checador sin filtrar credenciales ni inventar apellidos', () => {
    const p = perfilCompartido({ id: 71, nombre: 'María del Carmen Pérez', activo: true, password_hash: 'secreto', activacion_hash: 'secreto', token_version: 8 });
    assert.equal(p.idCliente, '71');
    assert.equal(p.codigoAcceso, 'CLI-71');
    assert.equal(p.nombreCompleto, 'María del Carmen Pérez');
    assert.equal(p.apellidos, '');
    assert.ok(!JSON.stringify(p).includes('secreto'));
});

test('API móvil comparte PostgreSQL, protege identidad, activa una sola vez y conserva datos omitidos', async t => {
    const secreto = 'secreto-movil-de-pruebas-independiente-123456';
    const staffSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'staff-pruebas-separado';
    t.after(() => { if (staffSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = staffSecret; });
    let cliente: any;
    let acceso: any = {};
    let snapshots: any;
    let rollback = 0;
    const sqls: string[] = [];
    const query = async (sql: string, v: any[] = []) => {
        sqls.push(sql);
        if (sql === 'BEGIN') { snapshots = structuredClone({ cliente, acceso }); return { rows: [] }; }
        if (sql === 'COMMIT') return { rows: [] };
        if (sql === 'ROLLBACK') { rollback++; ({ cliente, acceso } = snapshots); return { rows: [] }; }
        if (sql.startsWith('INSERT INTO webcobro.clientes (')) {
            cliente = { id: 71, nombre: v[0], correo: v[1], telefono: v[2], activo: true, enfermedades: v[3], lesiones: v[4] };
            return { rows: [cliente] };
        }
        if (sql.startsWith('INSERT INTO webcobro.clientes_acceso_movil')) {
            if (sql.includes('activacion_hash')) acceso = { ...acceso, activacion_hash: v[1], token_version: 0 };
            else acceso = { password_hash: v[1], token_version: 0 };
            return { rows: [] };
        }
        if (sql.startsWith('UPDATE webcobro.clientes_acceso_movil')) {
            acceso.password_hash = v[1]; acceso.activacion_hash = null;
            if (sql.includes('token_version + 1')) acceso.token_version++;
            return { rows: [] };
        }
        if (sql.startsWith('UPDATE webcobro.clientes SET')) {
            const campos = sql.split(' SET ')[1].split(' WHERE ')[0].split(', ').map(c => c.split(' = ')[0]);
            campos.forEach((campo, i) => { cliente[campo] = v[i]; });
            return { rows: [cliente] };
        }
        if (sql.includes('SELECT password_hash FROM')) return { rows: cliente ? [acceso] : [] };
        if (sql.includes('a.activacion_expira > NOW()')) return { rows: cliente?.activo && !acceso.password_hash && acceso.activacion_hash === v[1] ? [{ ...cliente, ...acceso }] : [] };
        if (sql.includes('JOIN webcobro.clientes_acceso_movil')) return { rows: cliente ? [{ ...cliente, ...acceso }] : [] };
        if (sql.includes('FROM webcobro.clientes')) return { rows: cliente && (v[0] === 71 || v[0] === cliente.correo) ? [cliente] : [] };
        throw new Error(`SQL inesperado: ${sql}`);
    };
    const pool = { query, connect: async () => ({ query, release() {} }) } as unknown as Pool;
    const app = express(); app.use(express.json()); app.use('/api', crearRutasClientesMovil(pool, () => secreto));
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
    const address = server.address() as import('node:net').AddressInfo;
    const enviar = (ruta: string, body?: unknown, token?: string, method = 'POST') => fetch(`http://127.0.0.1:${address.port}/api${ruta}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let r = await enviar('/auth/registro', { nombre: 'Ana', apellidos: 'Pérez', correo: 'ANA@EJEMPLO.COM', lesiones: ['Rodilla'], password: 'password123', confirmarPassword: 'password123' });
    assert.equal(r.status, 201);
    const alta = await r.json(); const token = alta.token;
    assert.equal(alta.cliente.codigoAcceso, 'CLI-71');
    assert.notEqual(acceso.password_hash, 'password123');
    assert.equal((await enviar('/me', undefined, token, 'GET')).status, 200);
    assert.equal((await enviar('/me', { id: 8 }, token, 'PATCH')).status, 400);
    r = await enviar('/me', { telefono: '1234567890' }, token, 'PATCH');
    assert.equal(r.status, 200); assert.deepEqual((await r.json()).lesiones, ['Rodilla']);
    r = await enviar('/auth/registro', { nombre: 'Ana', correo: 'ana@ejemplo.com', password: 'password123', confirmarPassword: 'password123' });
    assert.equal(r.status, 409); assert.equal(rollback, 1); assert.equal(cliente.id, 71);
    assert.equal((await enviar('/auth/login', { correo: cliente.correo, password: 'password123' })).status, 200);
    assert.equal((await enviar('/me', undefined, jwt.sign({ rol: 'administrador' }, secreto), 'GET')).status, 401);
    cliente.activo = false;
    assert.equal((await enviar('/me', undefined, token, 'GET')).status, 401);
    cliente.activo = true; acceso.token_version++;
    assert.equal((await enviar('/me', undefined, token, 'GET')).status, 401);
    acceso.password_hash = null;
    const staff = jwt.sign({ rol: 'recepcion' }, process.env.JWT_SECRET!, { subject: 'staff' });
    assert.equal((await enviar('/clientes/71/activacion')).status, 401);
    assert.equal((await enviar('/clientes/71/activacion', {}, token)).status, 401);
    const activacion = await (await enviar('/clientes/71/activacion', {}, staff)).json();
    assert.equal(activacion.codigoActivacion.length, 32);
    assert.notEqual(acceso.activacion_hash, activacion.codigoActivacion);
    const activar = (codigoAcceso: string) => enviar('/auth/activar-cuenta', { correo: cliente.correo, codigoAcceso, password: 'nueva12345', confirmarPassword: 'nueva12345' });
    assert.equal((await activar('CLI-71')).status, 401);
    assert.equal((await activar(activacion.codigoActivacion)).status, 200);
    assert.equal((await activar(activacion.codigoActivacion)).status, 401);
    assert.ok(sqls.every(sql => !/DELETE FROM|DROP TABLE|UPDATE webcobro\.reservas/i.test(sql)));
});

test('sin secreto independiente, el registro no escribe datos', async t => {
    let consultas = 0;
    const pool = { query: async () => { consultas++; }, connect: async () => { consultas++; } } as unknown as Pool;
    const app = express(); app.use(express.json()); app.use(crearRutasClientesMovil(pool, () => undefined));
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
    const r = await fetch(`http://127.0.0.1:${(server.address() as any).port}/auth/registro`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 503); assert.equal(consultas, 0);
});