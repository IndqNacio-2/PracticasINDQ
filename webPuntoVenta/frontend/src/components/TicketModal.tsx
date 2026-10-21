import type { SaleRecord } from '../types';
import MaterialIcon from './MaterialIcon';

const fmt = (n: number) => `$${n.toFixed(2)}`;
const METHOD_LABELS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

export default function TicketModal({ sale, onClose }: { sale: SaleRecord; onClose: () => void }) {
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
            className="flex-1 py-2.5 border border-[#E5E7EB] text-[#6B7280] rounded-xl hover:bg-[#F9FAFB] transition-colors text-sm font-medium"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-2 py-2.5 bg-[#0D0F14] text-white rounded-xl hover:bg-[#1F2937] transition-colors text-sm font-semibold"
          >
            <MaterialIcon name="print" className="text-lg" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
