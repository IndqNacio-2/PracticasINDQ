const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const salud = fs.readFileSync(path.join(root, 'src/sections/webAdministrativa/features/clientes/SaludEtiquetas.tsx'), 'utf8');
const clientes = fs.readFileSync(path.join(root, 'src/sections/webAdministrativa/features/clientes/ClientesPage.tsx'), 'utf8');

test('lesiones: conserva las ocho partes del cuerpo del último cambio de Carlos Estrada', () => {
  for (const [value, label] of [
    ['brazo', 'Brazo'], ['mano', 'Mano'], ['pierna', 'Pierna'], ['cintura', 'Cintura'],
    ['espalda', 'Espalda'], ['hombro', 'Hombro'], ['cuello', 'Cuello'], ['pie', 'Pie'],
  ]) {
    assert.match(salud, new RegExp(`value: '${value}', label: '${label}'`));
  }
});

test('lesiones: guarda parte y descripción en el formato compatible con el backend existente', () => {
  assert.match(salud, /return detalle \? `\$\{nombreParte\}: \$\{detalle\}` : nombreParte/);
  assert.match(salud, /entrada\.indexOf\(':'\)/);
  assert.match(salud, /item\.toLocaleLowerCase\(\) === entrada\.toLocaleLowerCase\(\)/);
});

test('clientes: usa la lista especializada y sigue enviando form.lesiones', () => {
  assert.match(clientes, /import ListaSalud, \{ ListaLesiones, SaludEtiquetas \}/);
  assert.match(clientes, /<ListaLesiones[\s\S]*items=\{form\.lesiones\}[\s\S]*onChange=\{lesiones => setForm/);
  assert.match(clientes, /lesiones: form\.lesiones/);
  assert.doesNotMatch(clientes, /<ListaSalud[^>]*label="Lesiones"/);
});