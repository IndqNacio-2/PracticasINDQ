const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fuente = fs.readFileSync(path.resolve(__dirname, '../src/sections/webCobro/pages/asistencia.jsx'), 'utf8');
const inicio = fuente.indexOf('const normalizar =');
const fin = fuente.indexOf(';', fuente.indexOf('const coincidePersona =')) + 1;
const { coincidePersona } = vm.runInNewContext(`${fuente.slice(inicio, fin)}; ({ coincidePersona });`);

test('checador: permite marcar código personalizado resuelto sin confundir otra búsqueda', () => {
  const cliente = { codigo: 'CLI-2', codigoIngresado: 'SOC-ANA' };
  assert.equal(coincidePersona('SOC-ANA', cliente), true);
  assert.equal(coincidePersona('CLI-2', cliente), true);
  assert.equal(coincidePersona('2', cliente), true);
  assert.equal(coincidePersona('SOC-JOSE', cliente), false);
  assert.equal(coincidePersona('3', cliente), false);
  assert.equal(coincidePersona('SOC-ANA', null), false);
});

test('checador: usuario administrativo usa código visible e identidad estable', () => {
  const usuario = { codigo: 'USR-ABCDEF123456ABCDEF123456', codigoIngresado: 'A101' };
  assert.equal(coincidePersona('A101', usuario), true);
  assert.equal(coincidePersona(usuario.codigo, usuario), true);
  assert.equal(coincidePersona('A102', usuario), false);
  assert.equal(coincidePersona('EMP-101', { codigo: 'EMP-101' }), true);
});