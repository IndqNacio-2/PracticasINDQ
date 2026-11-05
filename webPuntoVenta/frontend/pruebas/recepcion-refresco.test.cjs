const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fuente = fs.readFileSync(path.resolve(__dirname, '../src/sections/webCobro/pages/dashboard.jsx'), 'utf8');
const efecto = fuente.slice(fuente.indexOf('  // Refresco automático:'), fuente.indexOf('  // ========== FUNCIONES DE VALIDACIÓN'));

test('Recepción refresca datos automáticamente, evita solapamiento y limpia listeners', async () => {
  let limpiar;
  const eventos = new Map();
  const llamadas = [];
  const aplicados = [];
  const ventana = {
    addEventListener: (nombre, fn) => eventos.set(nombre, fn),
    removeEventListener: nombre => eventos.delete(nombre),
  };
  const contexto = {
    useEffect: fn => { limpiar = fn(); },
    isModalOpen: false, isPaymentModalOpen: false, verMembresias: false,
    reservaAReagendar: null, ticket: null, buscandoCodigo: false,
    fechaReserva: '2026-11-05', API: '/cobro', AbortController,
    EVENTO_CAMBIO_APLICACION: 'rx:datos-actualizados', CLAVE_CAMBIO_APLICACION: 'rx:ultimo-cambio',
    document: { ...ventana, visibilityState: 'visible' }, window: ventana, navigator: { onLine: true },
    fetch: async (url, options) => { llamadas.push({ url, options }); return { ok: true, json: async () => [] }; },
    setReservations: datos => aplicados.push(datos), setKpis() {}, setClientes() {}, setClases() {}, setHorarios() {},
    console: { warn() {} },
  };
  vm.runInNewContext(efecto, contexto);
  const tick = () => eventos.get('rx:datos-actualizados')();
  assert.equal(llamadas.length, 5);
  await new Promise(resolve => setImmediate(resolve));
  await tick();
  assert.equal(llamadas.length, 10);
  assert.equal(aplicados.length, 2);
  assert.ok(llamadas.every(c => c.options.cache === 'no-store'));
  contexto.document.visibilityState = 'hidden';
  await tick();
  assert.equal(llamadas.length, 10);
  contexto.document.visibilityState = 'visible';
  await eventos.get('focus')();
  assert.equal(llamadas.length, 15);
  const signal = llamadas[0].options.signal;
  limpiar();
  assert.equal(signal.aborted, true);
  assert.equal(eventos.size, 0);
  assert.doesNotMatch(fuente, /handleActualizar|setActualizando/);
  assert.doesNotMatch(efecto, /setInterval/);
});

test('refresco no inicia con una venta o reservación abierta', () => {
  for (const campo of ['isModalOpen', 'isPaymentModalOpen', 'verMembresias', 'reservaAReagendar', 'ticket', 'buscandoCodigo']) {
    const contexto = { useEffect: fn => assert.equal(fn(), undefined),
      isModalOpen: false, isPaymentModalOpen: false, verMembresias: false,
      reservaAReagendar: null, ticket: null, buscandoCodigo: false, fechaReserva: '2026-11-05', [campo]: true };
    vm.runInNewContext(efecto, contexto);
  }
});