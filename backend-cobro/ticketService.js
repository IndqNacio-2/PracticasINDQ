// Adaptación del servicio de Carlos: ESC/POS por red sin dependencias adicionales.
// Desactivado por defecto. Un fallo de impresión nunca revierte un cobro.
const net = require('node:net');
const ANCHO = 42;
const fmt = (valor) => Number(valor || 0).toLocaleString('es-MX', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

// Impide que nombres o referencias inyecten órdenes de control a la impresora.
const texto = (valor) => String(valor ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, ' ').trim();
const fila = (izquierda, derecha) => {
  const der = texto(derecha).slice(0, ANCHO - 2);
  const izq = texto(izquierda).slice(0, ANCHO - der.length - 1);
  return izq + ' '.repeat(ANCHO - izq.length - der.length) + der;
};

function crearContenidoTicket(pago) {
  const fecha = new Date(pago.fecha);
  const lineas = [
    'NUUCLEO',
    pago.contexto === 'pos' ? 'VENTA DE MOSTRADOR' : pago.contexto === 'membresia' ? 'VENTA DE MEMBRESIA' : 'COBRO DE SERVICIOS',
    '='.repeat(ANCHO),
    fila('Folio:', pago.folio),
    fila('Fecha:', Number.isNaN(fecha.getTime()) ? '-' : fecha.toLocaleString('es-MX', { hour12: false })),
    fila('Atendio:', pago.usuario || 'Recepcion'),
    fila('Cliente:', pago.cliente_nombre ?? pago.cliente ?? '-'),
  ];
  const reserva = pago.codigo_reserva ?? pago.reservaId;
  if (reserva != null) lineas.push(fila('Reserva:', reserva));
  if (pago.fechaClase) lineas.push(fila('Clase:', `${pago.fechaClase} ${pago.horaClase || ''}`));
  if (pago.fechaInicio) lineas.push(fila('Inicio:', pago.fechaInicio));
  if (pago.fechaFin) lineas.push(fila('Vigencia hasta:', pago.fechaFin));
  lineas.push('-'.repeat(ANCHO));
  for (const item of pago.items || []) {
    const cantidad = Number(item.cantidad ?? 1);
    const precio = Number(item.precioUnitario ?? 0);
    lineas.push(texto(item.descripcion || 'SERVICIO').slice(0, ANCHO));
    lineas.push(fila(`${cantidad} x $${fmt(precio)}`, `$${fmt(cantidad * precio)}`));
  }
  lineas.push('='.repeat(ANCHO), fila('TOTAL:', `$${fmt(pago.total)}`));
  const pagos = pago.pagos || [{ metodo: pago.metodoPago, monto: pago.total }];
  for (const parcial of pagos) lineas.push(fila(`Pago ${parcial.metodo || '-'}`, `$${fmt(parcial.monto)}`));
  if (pago.efectivoRecibido != null) lineas.push(fila('Recibido:', `$${fmt(pago.efectivoRecibido)}`));
  lineas.push(fila('Cambio:', `$${fmt(pago.cambio)}`));
  if (pago.referencia) lineas.push(fila('Referencia:', pago.referencia));
  lineas.push('='.repeat(ANCHO), 'Gracias por su visita.', 'Este ticket es su comprobante.', '', '', '');
  return Buffer.concat([
    Buffer.from([0x1b, 0x40]),
    Buffer.from(lineas.join('\n') + '\n', 'ascii'),
    Buffer.from([0x1d, 0x56, 0x00]),
  ]);
}

function imprimirTicket(pago, opciones = {}) {
  const habilitada = opciones.habilitada ?? process.env.TICKET_IMPRESION_HABILITADA === 'true';
  const host = opciones.host ?? process.env.PRINTER_IP;
  if (!habilitada || !host) return Promise.resolve(false);
  const port = Number(opciones.port ?? process.env.PRINTER_PORT ?? 9100);
  const timeout = Number(opciones.timeout ?? process.env.PRINTER_TIMEOUT_MS ?? 2000);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isFinite(timeout) || timeout <= 0) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    let terminado = false;
    const socket = new net.Socket();
    const finalizar = (resultado) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(limite);
      socket.destroy();
      resolve(resultado);
    };
    const limite = setTimeout(() => finalizar(false), timeout);
    socket.on('error', () => finalizar(false));
    socket.on('close', () => finalizar(false));
    try {
      const contenido = crearContenidoTicket(pago);
      socket.connect(port, host, () => socket.end(contenido, () => finalizar(true)));
    } catch {
      finalizar(false);
    }
  });
}

module.exports = { crearContenidoTicket, imprimirTicket };