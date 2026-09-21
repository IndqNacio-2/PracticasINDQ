import type { SaleRecord } from '../types';
import MaterialIcon from './MaterialIcon';

const fmt = (n: number) => `$${n.toFixed(2)}`;
const METHOD_LABELS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

interface SaleSuccessModalProps {
  sale: SaleRecord;
  onNewSale: () => void;
  onShowTicket: () => void;
}

export default function SaleSuccessModal({ sale, onNewSale, onShowTicket }: SaleSuccessModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="modal-enter bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Success header */}
        <div className="bg-[#F0FDF4] px-6 py-7 text-center">
          <div className="w-16 h-16 bg-[#10B981] rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-green-200">
            <MaterialIcon name="check" className="text-4xl text-white" filled />
          </div>
          <h2 className="text-xl font-bold text-[#065F46]">Venta realizada correctamente</h2>
        </div>

        {/* Sale details */}
        <div className="px-6 py-4">
          <div className="bg-[#F9FAFB] rounded-xl p-4 space-y-2.5 text-sm mb-5">
            <Row label="Folio" value={<span className="font-bold text-[#0D0F14]">{sale.folio}</span>} />
            <Row label="Fecha" value={sale.date} />
            <Row label="Hora" value={sale.time} />
            <Row label="Método" value={METHOD_LABELS[sale.paymentMethod]} />
            {sale.cashReceived !== undefined && (
              <>
                <Row label="Recibido" value={fmt(sale.cashReceived)} />
                <Row label="Cambio" value={
                  <span className="font-bold text-[#10B981]">{fmt(sale.change ?? 0)}</span>
                } />
              </>
            )}
            {sale.transferRef && <Row label="Referencia" value={sale.transferRef} />}
            <div className="flex justify-between items-center pt-2.5 border-t border-[#E5E7EB]">
              <span className="font-bold text-[#0D0F14]">Total pagado</span>
              <span className="text-xl font-bold tabular-nums" style={{ color: '#FF5C00', fontFamily: 'Outfit, sans-serif' }}>
                {fmt(sale.total)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onShowTicket}
              className="flex w-full items-center justify-center gap-2 py-2.5 border-2 font-semibold rounded-xl transition-colors text-sm hover:bg-[#FFF5F0]"
              style={{ borderColor: '#FF5C00', color: '#FF5C00' }}
            >
              <MaterialIcon name="receipt_long" className="text-lg" />
              Imprimir ticket
            </button>
            <button
              type="button"
              onClick={onNewSale}
              className="flex w-full items-center justify-center gap-2 py-3 text-white font-bold rounded-xl transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ fontFamily: 'Outfit, sans-serif', backgroundColor: '#FF5C00' }}
            >
              <MaterialIcon name="add_shopping_cart" className="text-lg" />
              Nueva venta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#6B7280]">{label}</span>
      <span className="text-[#0D0F14]">{value}</span>
    </div>
  );
}
