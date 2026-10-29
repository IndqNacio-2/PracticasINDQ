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
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

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
            h1 { font-size: 17px; text-align: center; }
            .center { text-align: center; }
            .muted { color: #555; }
            .line { border-top: 1px dashed #555; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; gap: 12px; }
            .item { margin: 8px 0; }
            .total { font-size: 15px; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>CENTRO DE ENTRENAMIENTO</h1>
          <p class="center muted">Comprobante de venta</p>
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
          ${sale.cashReceived !== undefined ? `<p><strong>Recibido:</strong> ${escapeHtml(fmt(sale.cashReceived))}</p>` : ''}
          ${sale.change !== undefined ? `<p><strong>Cambio:</strong> ${escapeHtml(fmt(sale.change))}</p>` : ''}
          ${sale.transferRef ? `<p><strong>Referencia:</strong> ${escapeHtml(sale.transferRef)}</p>` : ''}
          <div class="line"></div>
          <p class="center">Gracias por su compra.</p>
          <p class="center">¡Sigue entrenando fuerte!</p>
          <script>window.addEventListener('load', () => window.print());<\/script>
        </body>
      </html>`);
    popup.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="modal-enter bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-[#0D0F14] px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-bold text-sm">Vista previa del ticket</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar ticket" className="text-white/50 hover:text-white transition-colors">
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </div>

        {/* Ticket body */}
        <div className="max-h-[65vh] overflow-y-auto">
          <div className="px-8 py-6" style={{ fontFamily: 'monospace' }}>
            <div className="text-center mb-5">
              <p className="font-bold text-base text-[#0D0F14] tracking-wide">CENTRO DE ENTRENAMIENTO</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">www.migimnasio.mx</p>
            </div>

            <div className="text-xs text-[#374151] space-y-1 mb-4">
              <p><span className="text-[#9CA3AF]">Folio:</span> <strong>{sale.folio}</strong></p>
              <p><span className="text-[#9CA3AF]">Fecha:</span> {sale.date}</p>
              <p><span className="text-[#9CA3AF]">Hora:</span> {sale.time}</p>
            </div>

            <div className="border-t border-dashed border-[#D1D5DB] pt-4 mb-4">
              {sale.items.map((item, i) => (
                <div key={i} className="mb-3">
                  <p className="text-xs font-bold text-[#0D0F14]">{item.name}</p>
                  <div className="flex justify-between text-xs text-[#6B7280]">
                    <span>{item.qty} × {fmt(item.unitPrice)}</span>
                    <span className="font-semibold text-[#0D0F14] tabular-nums">{fmt(item.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-[#D1D5DB] pt-4 space-y-1.5 text-xs">
              {sale.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Descuento</span>
                  <span className="tabular-nums">-{fmt(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm">
                <span>TOTAL</span>
                <span className="tabular-nums">{fmt(sale.total)}</span>
              </div>
              <div className="pt-1.5 space-y-1">
                <p><span className="text-[#6B7280]">Método:</span> {METHOD_LABELS[sale.paymentMethod]}</p>
                {sale.cashReceived !== undefined && (
                  <>
                    <p><span className="text-[#6B7280]">Recibido:</span> <span className="tabular-nums">{fmt(sale.cashReceived)}</span></p>
                    <p><span className="text-[#6B7280]">Cambio:</span> <strong className="tabular-nums">{fmt(sale.change ?? 0)}</strong></p>
                  </>
                )}
                {sale.transferRef && (
                  <p><span className="text-[#6B7280]">Referencia:</span> {sale.transferRef}</p>
                )}
              </div>
            </div>

            <div className="text-center mt-6 pt-4 border-t border-dashed border-[#D1D5DB]">
              <p className="text-xs text-[#9CA3AF]">Gracias por su compra.</p>
              <p className="text-xs text-[#9CA3AF]">¡Sigue entrenando fuerte!</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-[#E5E7EB] flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 border border-[#E5E7EB] text-[#6B7280] rounded-xl hover:bg-[#F9FAFB] transition-colors text-sm font-medium"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={printTicket}
            className="flex flex-1 items-center justify-center gap-2 py-2.5 bg-[#0D0F14] text-white rounded-xl hover:bg-[#1F2937] transition-colors text-sm font-semibold"
          >
            <MaterialIcon name="print" className="text-lg" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={onNewSale}
            className="flex items-center justify-center rounded-xl bg-[#6B7280] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4B5563]"
            aria-label="Iniciar nueva venta"
            title="Nueva venta"
          >
            <MaterialIcon name="add_shopping_cart" className="text-lg" />
          </button>
        </div>
      </div>
    </div>
  );
}
