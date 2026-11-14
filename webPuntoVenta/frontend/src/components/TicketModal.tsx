import type { SaleRecord } from '../types';
import MaterialIcon from './MaterialIcon';

const fmt = (n: number) =>
  n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
  });
const METHOD_LABELS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

interface TicketModalProps {
  sale: SaleRecord;
  onClose: () => void;
  onNewSale: () => void;
}

export default function TicketModal({ sale, onClose, onNewSale }: TicketModalProps) {
  /**
   * Abro un documento exclusivo para el comprobante. Así el navegador imprime
   * solamente el ticket y no toda la pantalla del Punto de Venta.
   */
  const printTicket = () => {
    const popup = window.open('', '_blank', 'width=420,height=720');

    if (!popup) {
      window.alert('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes e intenta otra vez.');
      return;
    }

    const escapeHtml = (value: unknown) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const items = sale.items
      .map(
        (item) => `
          <div class="item">
            <strong>${escapeHtml(item.name)}</strong>
            <div class="row">
              <span>${item.qty} × ${escapeHtml(fmt(item.unitPrice))}</span>
              <span>${escapeHtml(fmt(item.subtotal))}</span>
            </div>
          </div>`,
      )
      .join('');

    popup.document.write(`<!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <title>Ticket ${escapeHtml(sale.folio)}</title>
          <style>
            @page { size: 80mm auto; margin: 6mm; }
            * { box-sizing: border-box; }
            body { width: 68mm; margin: 0 auto; color: #111; font: 12px/1.4 monospace; }
            h1, p { margin: 0; }
            h1 { font-size: 18px; text-align: center; }
            .center { text-align: center; }
            .muted { color: #555; }
            .line { border-top: 1px dashed #555; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; gap: 12px; }
            .item { margin: 8px 0; }
            .total { font-size: 15px; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>NUUCLEO</h1>
          <p class="center">Comprobante de venta</p>
          <div class="line"></div>
          <p><strong>Folio:</strong> ${escapeHtml(sale.folio)}</p>
          <p><strong>Fecha:</strong> ${escapeHtml(sale.date)}</p>
          <p><strong>Hora:</strong> ${escapeHtml(sale.time)}</p>
          <div class="line"></div>
          ${items}
          <div class="line"></div>
          <div class="row"><span>Subtotal</span><span>${escapeHtml(fmt(sale.subtotal))}</span></div>
          ${sale.discount > 0 ? `<div class="row"><span>Descuento</span><span>-${escapeHtml(fmt(sale.discount))}</span></div>` : ''}
          <div class="row total"><span>TOTAL</span><span>${escapeHtml(fmt(sale.total))}</span></div>
          <p><strong>Método:</strong> ${escapeHtml(METHOD_LABELS[sale.paymentMethod])}</p>
          ${sale.paymentMethod === 'efectivo' && sale.cashReceived != null ? `<p><strong>Recibido:</strong> ${escapeHtml(fmt(sale.cashReceived))}</p>` : ''}
          ${sale.paymentMethod === 'efectivo' && sale.change != null ? `<p><strong>Cambio:</strong> ${escapeHtml(fmt(sale.change))}</p>` : ''}
          ${sale.transferRef ? `<p><strong>Referencia:</strong> ${escapeHtml(sale.transferRef)}</p>` : ''}
          <div class="line"></div>
          <p class="center">Gracias por su compra.</p>
          <script>window.addEventListener('load', () => window.print());<\/script>
        </body>
      </html>`);
    popup.document.close();
  };

  return (
    <div className="rx-modal-overlay" role="presentation">
      <section className="rx-modal rx-modal--scroll modal-enter" role="dialog" aria-modal="true" aria-labelledby="ticket-venta-titulo">
        <header className="rx-modal-header">
          <div>
            <h2 id="ticket-venta-titulo" className="rx-modal-title">Venta registrada</h2>
            <p className="rx-modal-subtitle rx-modal-subtitle--plain">Ticket {sale.folio}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar ticket" className="rx-modal-close">
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </header>

        {/* Ticket body */}
        <div className="rx-modal-body">
          <div className="rx-receipt">
            <div className="rx-receipt-head">
              <p className="rx-receipt-brand">NUUCLEO</p>
              <p className="rx-receipt-label">Comprobante de venta</p>
            </div>

            <div className="rx-receipt-section">
              <p><span className="rx-receipt-label">Folio:</span> {sale.folio}</p>
              <p><span className="rx-receipt-label">Fecha:</span> {sale.date}</p>
              <p><span className="rx-receipt-label">Hora:</span> {sale.time}</p>
            </div>

            <div className="rx-receipt-section">
              {sale.items.map((item, i) => (
                <div key={i} className="rx-receipt-item">
                  <p className="rx-cell-strong">{item.name}</p>
                  <div className="rx-receipt-row">
                    <span>{item.qty} × {fmt(item.unitPrice)}</span>
                    <span>{fmt(item.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rx-receipt-section">
              <div className="rx-receipt-row"><span>Subtotal</span><span>{fmt(sale.subtotal)}</span></div>
              {sale.discount > 0 && (
                <div className="rx-receipt-row">
                  <span>Descuento</span>
                  <span>-{fmt(sale.discount)}</span>
                </div>
              )}
              <div className="rx-receipt-row rx-receipt-total">
                <span>TOTAL</span>
                <span>{fmt(sale.total)}</span>
              </div>
              <div>
                <p><span className="rx-receipt-label">Método:</span> {METHOD_LABELS[sale.paymentMethod]}</p>
                {sale.paymentMethod === 'efectivo' && sale.cashReceived != null && <p><span className="rx-receipt-label">Recibido:</span> {fmt(sale.cashReceived)}</p>}
                {sale.paymentMethod === 'efectivo' && sale.change != null && <p><span className="rx-receipt-label">Cambio:</span> {fmt(sale.change)}</p>}
                {sale.transferRef && (
                  <p><span className="rx-receipt-label">Referencia:</span> {sale.transferRef}</p>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Actions */}
        <footer className="rx-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="rx-btn rx-btn--outline"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={printTicket}
            className="rx-btn rx-btn--dark"
          >
            <MaterialIcon name="print" className="text-lg" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={onNewSale}
            className="rx-btn rx-btn--outline"
            aria-label="Iniciar nueva venta"
            title="Nueva venta"
          >
            <MaterialIcon name="add_shopping_cart" className="text-lg" />
          </button>
        </footer>
      </section>
    </div>
  );
}
