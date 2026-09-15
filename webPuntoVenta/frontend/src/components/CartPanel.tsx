import type { Product, CartItem } from '../types';

const fmt = (n: number) => `$${n.toFixed(2)}`;

interface CartPanelProps {
  cart: CartItem[];
  products: Product[];
  subtotal: number;
  discount: number;
  total: number;
  onUpdateQuantity: (productId: number, delta: number) => void;
  onRemove: (productId: number) => void;
  onCobrar: () => void;
  onCancelVenta: () => void;
}

export default function CartPanel({
  cart, products, subtotal, discount, total,
  onUpdateQuantity, onRemove, onCobrar, onCancelVenta,
}: CartPanelProps) {
  const getProduct = (id: number) => products.find(p => p.id === id)!;

  return (
    <div className="flex flex-col bg-white border-l border-[#E5E7EB]" style={{ width: '35%', minWidth: 300 }}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E5E7EB] flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0D0F14]">Venta actual</h2>
          {cart.length > 0 && (
            <span className="text-xs bg-[#FF5C00] text-white font-bold px-2 py-0.5 rounded-full">
              {cart.reduce((s, i) => s + i.quantity, 0)} artículos
            </span>
          )}
        </div>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-8">
            <div className="w-16 h-16 bg-[#F9FAFB] rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-[#D1D5DB]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-sm text-[#9CA3AF] leading-snug max-w-[180px]">
              Agrega productos para comenzar una venta
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {cart.map(item => {
              const p = getProduct(item.productId);
              return (
                <div key={item.productId} className="bg-[#F9FAFB] rounded-xl p-3">
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xl flex-shrink-0">{p.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0D0F14] truncate">{p.name}</p>
                        <p className="text-xs text-[#9CA3AF]">{fmt(p.price)} c/u</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onRemove(item.productId)}
                      className="w-6 h-6 flex items-center justify-center text-[#D1D5DB] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition-colors flex-shrink-0 ml-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUpdateQuantity(item.productId, -1)}
                        className="w-7 h-7 bg-white border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#374151] hover:border-[#FF5C00] hover:text-[#FF5C00] transition-colors text-base font-bold leading-none"
                      >
                        −
                      </button>
                      <span className="text-sm font-bold text-[#0D0F14] w-6 text-center tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.productId, 1)}
                        disabled={item.quantity >= p.stock}
                        className="w-7 h-7 bg-white border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#374151] hover:border-[#FF5C00] hover:text-[#FF5C00] transition-colors text-base font-bold leading-none disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-bold text-[#0D0F14] tabular-nums">
                      {fmt(p.price * item.quantity)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary + Actions */}
      <div className="flex-shrink-0 border-t border-[#E5E7EB] px-5 py-4">
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">Subtotal</span>
            <span className="text-[#0D0F14] font-medium tabular-nums">{fmt(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">Descuento</span>
            <span className="text-[#0D0F14] font-medium tabular-nums">{fmt(discount)}</span>
          </div>
          <div className="flex justify-between items-center pt-2.5 border-t border-[#E5E7EB]">
            <span className="text-base font-bold text-[#0D0F14]">Total</span>
            <span className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'Outfit, sans-serif', color: '#FF5C00' }}>
              {fmt(total)}
            </span>
          </div>
        </div>

        <button
          onClick={onCobrar}
          disabled={cart.length === 0}
          className="w-full py-3.5 text-white font-bold text-base rounded-xl transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] mb-2"
          style={{ fontFamily: 'Outfit, sans-serif', backgroundColor: '#FF5C00' }}
        >
          COBRAR
        </button>

        {cart.length > 0 && (
          <button
            onClick={onCancelVenta}
            className="w-full py-2 text-sm text-[#EF4444] hover:bg-[#FEF2F2] rounded-xl transition-colors font-medium"
          >
            Cancelar venta
          </button>
        )}
      </div>
    </div>
  );
}
