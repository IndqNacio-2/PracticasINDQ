const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const backendRoot = fs.existsSync(path.join(root, 'backend-administrativa')) ? root : path.resolve(root, '..');
const carpeta = path.join(root, 'src/sections/webAdministrativa/features/productos');
const fila = { idProducto: '7', codigo: 'P-007', nombre: 'Producto real', descripcion: 'Descripción',
  categoria: 'Bebidas', precio: 25, costo: 10, stock: 99, stockMinimo: 10,
  estatus: 'activo', icon: 'water_drop', bgColor: '#FFFFFF' };

function cargar() {
  const llamadas = []; const exports = {};
  const api = Object.fromEntries(['get', 'post', 'patch'].map(metodo => [metodo, async (ruta, body) => {
    llamadas.push({ metodo, ruta, body });
    if (metodo === 'get') return [fila];
    if (ruta === '/movimientos') return { producto: { ...fila, stock: 104 } };
    return { ...fila, estatus: body.status === 'inactive' ? 'inactivo' : 'activo' };
  }]));
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(carpeta, 'inventarioApi.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: () => ({ api }) });
  return { servicio: exports, llamadas };
}

test('administración reutiliza la pantalla del vendedor sin interfaz independiente de movimientos', () => {
  const codigo = fs.readFileSync(path.join(carpeta, 'ProductosPage.tsx'), 'utf8');
  assert.match(codigo, /import InventoryPage from '\.\.\/\.\.\/\.\.\/\.\.\/components\/InventoryPage'/);
  for (const accion of ['onAddProduct', 'onUpdateProduct', 'onAdjustStock', 'onToggleStatus']) {
    assert.ok(codigo.includes(accion));
  }
  assert.doesNotMatch(codigo, /Movimientos Recientes|movModal|DataTable|\/movimientos/);
  const rutas = fs.readFileSync(path.join(backendRoot, 'backend-administrativa/src/routes/productos.routes.ts'), 'utf8');
  assert.match(rutas, /requireRole\('administrador', 'vendedor'\)/);
});

test('catálogo conserva campos reales del POS y no consulta historial', async () => {
  const { servicio, llamadas } = cargar();
  const [producto] = await servicio.listarProductos();
  assert.equal(producto.id, 7); assert.equal(producto.code, 'P-007');
  assert.equal(producto.stock, 99); assert.equal(producto.minimumStock, 10);
  assert.equal(producto.icon, 'water_drop'); assert.equal(producto.status, 'active');
  assert.equal(llamadas.length, 1); assert.equal(llamadas[0].ruta, '/productos');
});

test('alta, edición y estado usan API autenticada; edición no sobreescribe stock', async () => {
  const { servicio, llamadas } = cargar();
  const [producto] = await servicio.listarProductos();
  const { id, ...datos } = producto;
  await servicio.crearProducto(datos);
  await servicio.editarProducto(producto);
  const inactivo = await servicio.cambiarEstado(id, 'inactive');
  assert.equal(llamadas[1].metodo, 'post'); assert.equal(llamadas[1].body.code, 'P-007');
  assert.equal(llamadas[2].ruta, '/productos/7');
  assert.equal('stock' in llamadas[2].body, false);
  assert.equal('id' in llamadas[2].body, false);
  assert.equal(inactivo.status, 'inactive');
});

test('agregar existencias conserva operación transaccional y rechaza cantidades inválidas', async () => {
  const { servicio, llamadas } = cargar();
  for (const cantidad of [0, -1, 1.5, NaN]) await assert.rejects(servicio.agregarExistencias(7, cantidad));
  assert.equal(llamadas.length, 0);
  const producto = await servicio.agregarExistencias(7, 5);
  assert.equal(producto.stock, 104);
  assert.equal(llamadas[0].ruta, '/movimientos');
  assert.equal(llamadas[0].body.tipo, 'entrada');
  assert.equal(llamadas[0].body.cantidad, 5);
});