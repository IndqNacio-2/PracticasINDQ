import { useState } from 'react';

type PayMethod = 'efectivo' | 'tarjeta' | 'transferencia';

interface PaymentModalProps {
  total: number;
  onConfirm: (data: { method: PayMethod; cashReceived?: number; transferRef?: string }) => void;
  onClose: () => void;
}

const fmt = (n: number) => `$${n.toFixed(2)}`;

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-sm text-[#9CA3AF] hover:text-[#FF5C00] mb-5 transition-colors">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Cambiar método
    </button>
  );
}

export default function PaymentModal({ total, onConfirm, onClose }: PaymentModalProps) {
  const [method, setMethod] = useState<PayMethod | null>(null);
  const [cashInput, setCashInput] = useState('');
  const [transferRef, setTransferRef] = useState('');

  const cashReceived = parseFloat(cashInput) || 0;
  const change = cashReceived - total;
  const cashInsufficient = cashInput !== '' && cashReceived < total;
  const canConfirm =
    method === 'tarjeta' ||
    method === 'transferencia' ||
    (method === 'efectivo' && cashReceived >= total);

  const handleConfirm = () => {
    if (!method || !canConfirm) return;
    onConfirm({
      method,
      cashReceived: method === 'efectivo' ? cashReceived : undefined,
      transferRef: method === 'transferencia' ? transferRef : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="modal-enter bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#0D0F14]">Cobro</h2>
            {method && (
              <p className="text-xs text-[#9CA3AF] mt-0.5 capitalize">{method}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Total banner */}
        <div className="px-6 py-5 bg-[#0D0F14] text-center">
          <p className="text-xs text-white/50 uppercase tracking-widest mb-1">Total a pagar</p>
          <p className="text-4xl font-bold text-white tabular-nums" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {fmt(total)}
          </p>
        </div>

        <div className="p-6">
          {/* Method selection */}
          {!method && (
            <div>
              <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-widest mb-4">Método de pago</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'efectivo' as PayMethod, label: 'Efectivo', icon: '💵' },
                  { key: 'tarjeta' as PayMethod, label: 'Tarjeta', icon: '💳' },
                  { key: 'transferencia' as PayMethod, label: 'Transferencia', icon: '📲' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setMethod(opt.key)}
                    className="flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 border-[#E5E7EB] hover:border-[#FF5C00] hover:bg-[#FFF5F0] transition-all duration-150 active:scale-95"
                  >
                    <span className="text-3xl">{opt.icon}</span>
                    <span className="text-sm font-semibold text-[#0D0F14]">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Efectivo */}
          {method === 'efectivo' && (
            <div>
              <BackBtn onClick={() => { setMethod(null); setCashInput(''); }} />
              <div className="mb-4">
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">Efectivo recibido</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280] font-semibold text-lg">$</span>
                  <input
                    type="number"
                    value={cashInput}
                    onChange={e => setCashInput(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                    className={`w-full pl-8 pr-4 py-3.5 border-2 rounded-xl text-xl font-bold focus:outline-none transition-colors tabular-nums ${
                      cashInsufficient
                        ? 'border-[#EF4444] text-[#EF4444] focus:border-[#EF4444]'
                        : 'border-[#E5E7EB] text-[#0D0F14] focus:border-[#FF5C00]'
                    }`}
                  />
                </div>
                {cashInsufficient && (
                  <p className="text-xs text-[#EF4444] font-semibold mt-1.5 flex items-center gap-1">
                    <span>⚠</span> Efectivo insuficiente
                  </p>
                )}
              </div>

              {cashReceived >= total && cashInput && (
                <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-[#166534]">Cambio</span>
                    <span className="text-2xl font-bold text-[#166534] tabular-nums" style={{ fontFamily: 'Outfit, sans-serif' }}>
                      {fmt(change)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tarjeta */}
          {method === 'tarjeta' && (
            <div>
              <BackBtn onClick={() => setMethod(null)} />
              <div className="bg-[#F9FAFB] rounded-xl p-5 text-center mb-4 border border-[#E5E7EB]">
                <span className="text-4xl mb-2 block">💳</span>
                <p className="text-xs text-[#9CA3AF] uppercase tracking-wide mb-1">Total a cobrar</p>
                <p className="text-3xl font-bold text-[#0D0F14] tabular-nums" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {fmt(total)}
                </p>
                <p className="text-xs text-[#9CA3AF] mt-2">Presentar en terminal física</p>
              </div>
            </div>
          )}

          {/* Transferencia */}
          {method === 'transferencia' && (
            <div>
              <BackBtn onClick={() => setMethod(null)} />
              <div className="bg-[#F9FAFB] rounded-xl p-4 mb-4 border border-[#E5E7EB]">
                <p className="text-xs text-[#9CA3AF] mb-0.5">Total a cobrar</p>
                <p className="text-2xl font-bold text-[#0D0F14] tabular-nums" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {fmt(total)}
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                  Referencia de transferencia{' '}
                  <span className="text-[#9CA3AF] font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={transferRef}
                  onChange={e => setTransferRef(e.target.value)}
                  placeholder="Ej. TRF-20260915-001"
                  className="w-full px-4 py-2.5 border-2 border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:border-[#FF5C00] text-[#0D0F14] transition-colors"
                />
              </div>
            </div>
          )}

          {method && (
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="w-full py-3.5 text-white font-bold text-base rounded-xl transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
              style={{ fontFamily: 'Outfit, sans-serif', backgroundColor: '#FF5C00' }}
            >
              Confirmar pago
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
