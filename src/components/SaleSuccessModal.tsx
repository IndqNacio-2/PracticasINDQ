// Importo el tipo ReactNode de forma explicita en lugar de usar el global React.
import type { ReactNode } from "react";
import type { SaleRecord } from '../types';
import MaterialIcon from './MaterialIcon';

const fmt = (n: number) => `$${n.toFixed(2)}`;
const METHOD_LABELS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', mixto: 'Mixto' };

interface SaleSuccessModalProps {
  sale: SaleRecord;
  onNewSale: () => void;
  onShowTicket: () => void;
}

export default function SaleSuccessModal({ sale, onNewSale, onShowTicket }: SaleSuccessModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="modal-enter bg-[var(--rx-surface)] rounded-[var(--rx-radius-extra-large)] w-full max-w-sm border border-[var(--rx-line)] shadow-[var(--rx-floating-shadow)] max-h-[90vh] overflow-y-auto">
        {/* Success header */}
        <div className="bg-[var(--rx-success-bg)] px-6 py-7 text-center">
          <div className="w-16 h-16 bg-[var(--rx-success)] rounded-full flex items-center justify-center mx-auto mb-3">
            <MaterialIcon name="check" className="text-4xl text-[color:var(--rx-surface)]" filled />
          </div>
          <h2 className="text-xl font-bold text-[color:var(--rx-success-ink)]">Venta realizada correctamente</h2>
        </div>

        {/* Sale details */}
        <div className="px-6 py-4">
          <div className="bg-[var(--rx-surface-soft)] rounded-[var(--rx-radius-medium)] p-4 space-y-2.5 text-sm mb-5">
            <Row label="Folio" value={<span className="font-bold text-[color:var(--rx-ink)]">{sale.folio}</span>} />
            <Row label="Fecha" value={sale.date} />
            <Row label="Hora" value={sale.time} />
            <Row label="Método" value={METHOD_LABELS[sale.paymentMethod]} />
            {sale.paymentMethod === 'mixto' && sale.payments?.map(part => <Row key={part.method} label={METHOD_LABELS[part.method]} value={fmt(part.amount)} />)}
            {(sale.paymentMethod === 'efectivo' || sale.paymentMethod === 'mixto') && sale.cashReceived != null && (
              <>
                <Row label="Recibido" value={fmt(sale.cashReceived)} />
                <Row label="Cambio" value={
                  <span className="font-bold text-[color:var(--rx-success)]">{fmt(sale.change ?? 0)}</span>
                } />
              </>
            )}
            {sale.transferRef && <Row label="Referencia" value={sale.transferRef} />}
            <div className="flex justify-between items-center pt-2.5 border-t border-[var(--rx-line)]">
              <span className="font-bold text-[color:var(--rx-ink)]">Total pagado</span>
              <span className="text-xl font-bold tabular-nums" style={{ color: 'var(--rx-dark)', fontFamily: 'var(--rx-font)' }}>
                {fmt(sale.total)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onShowTicket}
              className="rx-btn rx-btn--outline rx-btn--block"
            >
              <MaterialIcon name="receipt_long" className="text-lg" />
              Imprimir ticket
            </button>
            <button
              type="button"
              onClick={onNewSale}
              className="rx-btn rx-btn--dark rx-btn--block"
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

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-[color:var(--rx-ink-secondary)]">{label}</span>
      <span className="text-[color:var(--rx-ink)]">{value}</span>
    </div>
  );
}
