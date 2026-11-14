import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { requireRole } from './src/middleware/auth';
import type { UserRole } from './src/models/Usuarios/usuarios';

function comprobar(rol: unknown, permitidos: UserRole[], autenticado = true) {
  let estado = 200;
  let continua = false;
  const req = { auth: autenticado ? { id: 'usuario-prueba', rol } : undefined } as Request;
  const res = {
    status(codigo: number) { estado = codigo; return this; },
    json() { return this; },
  } as unknown as Response;
  requireRole(...permitidos)(req, res, () => { continua = true; });
  return { estado, continua };
}

test('roles de Alexis: acepta mayúsculas y espacios sin cambiar los roles locales', () => {
  for (const rol of ['administrador', 'Administrador', ' ADMINISTRADOR ']) {
    assert.deepEqual(comprobar(rol, ['administrador']), { estado: 200, continua: true });
  }
  for (const rol of ['entrenador', 'recepcion', 'vendedor'] as UserRole[]) {
    assert.deepEqual(comprobar(` ${rol.toUpperCase()} `, [rol]), { estado: 200, continua: true });
  }
});

test('normalizar roles no permite elevar permisos ni aceptar sesiones ausentes o roles inválidos', () => {
  for (const rol of ['vendedor', 'recepcion', 'entrenador', 'superadministrador', '', ' ', null, undefined, 123]) {
    assert.deepEqual(comprobar(rol, ['administrador']), { estado: 403, continua: false });
  }
  assert.deepEqual(comprobar('administrador', ['administrador'], false), { estado: 403, continua: false });
  assert.deepEqual(comprobar('administrador', []), { estado: 403, continua: false });
});