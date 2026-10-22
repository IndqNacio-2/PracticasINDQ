// ticketService.js (version CommonJS, compatible con tu serverWebCobro.js)
const escpos = require('escpos');
escpos.Network = require('escpos-network');

const ANCHO = 42; // 58mm. Cambiar a 48 si es de 80mm.
const fmt = n => Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function padRow(l, r) {
  const space = Math.max(1, ANCHO - l.length - r.length);
  return l + ' '.repeat(space) + r;
}
const line = (ch = '=') => ch.repeat(ANCHO);
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '.' : s);

function imprimirTicket(pago) {
  const ip = process.env.PRINTER_IP;
  if (!ip) {
    console.warn('PRINTER_IP no configurada. Ticket no impreso.');
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const device = new escpos.Network(ip, 9100);
    const printer = new escpos.Printer(device);

    device.open(err => {
      if (err) {
        console.error('Error conectando a impresora:', err.message);
        return resolve(false);
      }

      try {
        const d = new Date(pago.fecha);
        const lineas = pago.items || [];

        printer.font('a').align('ct').size(2, 2).style('b').text('NUUCLEO\n')
          .size(1, 1).style('').text('Gymfit\n').text(line('=') + '\n');

        const titulo = pago.contexto === 'pos' ? 'VENTA DE MOSTRADOR' : 'COBRO DE SERVICIOS';
        printer.align('ct').style('b').text(titulo + '\n').style('').align('lt');

        printer.text(padRow('Folio:', pago.folio) + '\n');
        printer.text(padRow('Fecha:', d.toLocaleDateString('es-MX')) + '\n');
        printer.text(padRow('Hora:', d.toLocaleTimeString('es-MX', { hour12: false })) + '\n');
        printer.text(padRow('Atendio:', pago.usuario ?? '-') + '\n');
        if (pago.codigo_reserva) printer.text(padRow('Reserva:', pago.codigo_reserva) + '\n');
        if (pago.cliente_nombre) printer.text(padRow('Cliente:', trunc(pago.cliente_nombre, 22)) + '\n');
        printer.text(line('-') + '\n');

        for (const l of lineas) {
          const desc = l.descripcion || 'SERVICIO';
          const cant = l.cantidad ?? 1;
          const pu = l.precioUnitario || 0;
          printer.style('b').text(trunc(desc.toUpperCase(), 38) + '\n').style('');
          printer.text('  ' + padRow(`${cant} x $${fmt(pu)}`, '$' + fmt(cant * pu)) + '\n');
        }

        printer.text(line('=') + '\n');
        printer.style('b').text(padRow('TOTAL A PAGAR:', '$' + fmt(pago.total)) + '\n').style('');
        printer.text(line('-') + '\n');

        for (const p of (pago.pagos || [])) {
          printer.text(padRow(`Pago ${p.metodo}:`, '$' + fmt(p.monto)) + '\n');
        }

        printer.text(line('-') + '\n');
        printer.style('bu').text(padRow('CAMBIO:', '$' + fmt(pago.cambio || 0)) + '\n').style('');
        printer.text(line('=') + '\n');
        printer.align('ct').text('\nGracias por su visita.\nEste ticket es su comprobante.\n\n\n');
        printer.align('lt').cut();

        printer.close(() => device.close(() => resolve(true)));
      } catch (e) {
        console.error('Error armando ticket:', e.message);
        resolve(false);
      }
    });
  });
}

module.exports = { imprimirTicket };