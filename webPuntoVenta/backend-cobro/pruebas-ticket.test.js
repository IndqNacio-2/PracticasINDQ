const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { once } = require('node:events');
const { crearContenidoTicket, imprimirTicket } = require('./ticketService');
const ticket = {
  folio: 'COB-PRUEBA', fecha: '2026-11-03T12:00:00Z', usuario: 'Recepción',
  cliente: 'Socio de prueba', reservaId: 12, total: 180, metodoPago: 'efectivo',
  efectivoRecibido: 200, cambio: 20,
  items: [{ descripcion: 'Yoga\x1b\x00', cantidad: 1, precioUnitario: 180 }],
};

test('formato compatible con el comprobante actual y sin controles inyectados', () => {
  const contenido = crearContenidoTicket(ticket);
  const texto = contenido.subarray(2, -3).toString('ascii');
  for (const campo of ['NUUCLEO', 'COB-PRUEBA', '180.00', '20.00', 'Socio de prueba', 'Yoga']) assert.ok(texto.includes(campo));
  assert.ok(!texto.includes('\x1b'));
  assert.deepEqual([...contenido.subarray(-3)], [0x1d, 0x56, 0]);
});

test('impresión desactivada y configuración inválida no fallan', async () => {
  assert.equal(await imprimirTicket(ticket, { habilitada: false }), false);
  assert.equal(await imprimirTicket(ticket, { habilitada: true, host: '127.0.0.1', port: -1 }), false);
});

test('envío ESC/POS a impresora simulada local, sin hardware ni datos reales', async () => {
  const recibidos = [];
  const server = net.createServer(socket => socket.on('data', datos => recibidos.push(datos)));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    assert.equal(await imprimirTicket(ticket, { habilitada: true, host: '127.0.0.1', port: server.address().port }), true);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
  assert.deepEqual(Buffer.concat(recibidos), crearContenidoTicket(ticket));
});

test('impresora desconectada devuelve false y no lanza error', async () => {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  assert.equal(await imprimirTicket(ticket, { habilitada: true, host: '127.0.0.1', port, timeout: 100 }), false);
});