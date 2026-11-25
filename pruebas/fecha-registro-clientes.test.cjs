const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const leer = p => fs.readFileSync(path.join(root, p), 'utf8');
const moduleFecha = { exports: {} };
vm.runInNewContext(ts.transpileModule(leer('src/sections/webAdministrativa/features/clientes/fechaRegistro.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: moduleFecha.exports });
const { formatearFechaRegistro } = moduleFecha.exports;
test('fecha ausente o inválida no se sustituye por hoy', () => {
  for (const valor of [undefined, null, '', 'invalida']) assert.equal(formatearFechaRegistro(valor), 'No disponible');
});
test('fecha histórica sin hora conserva su día y timestamp se presenta como fecha', () => {
  assert.equal(formatearFechaRegistro('2026-11-24'), '24/11/2026');
  assert.equal(formatearFechaRegistro('2026-11-24T12:00:00'), '24/11/2026');
});
test('perfil utiliza la fecha recibida y API la expone en listado, alta y edición', () => {
  const perfil = leer('src/sections/webAdministrativa/features/clientes/ClienteDetalle.tsx');
  assert.match(perfil, /fechaRegistro: socio.fechaRegistro \?\? ''/);
  const api = leer('backend-cobro/serverWebCobro.js');
  assert.equal((api.match(/to_jsonb\(clientes\)->>'fecha_registro' AS "fechaRegistro"/g) || []).length, 3);
});
test('migración agrega columna antes del default sin actualizar históricos', () => {
  const sql = leer('backend-cobro/db/fecha-registro-clientes.sql');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS fecha_registro TIMESTAMPTZ;/);
  assert.match(sql, /ALTER COLUMN fecha_registro SET DEFAULT CURRENT_TIMESTAMP;/);
  assert.doesNotMatch(sql, /\bUPDATE\b|\bDELETE\b|\bDROP\b/);
});