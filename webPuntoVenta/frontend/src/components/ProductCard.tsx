import type { Product } from "../types";
import MaterialIcon from "./MaterialIcon";

const fmt = (n: number) => `$${n.toFixed(2)}`;

interface ProductCardProps {
  product: Product;
  cartQty: number;
  onAdd: () => void;
}

export default function ProductCard({ product, cartQty, onAdd }: ProductCardProps) {
  const isOut = product.stock === 0;
  const isLow = product.stock > 0 && product.stock <= 3;
  const atMax = cartQty >= product.stock && !isOut;

  return (
    <div className={`bg-white rounded-2xl overflow-hidden border transition-all duration-150 ${
      isOut
        ? 'border-[#E5E7EB] opacity-60'
        : 'border-[#E5E7EB] hover:border-[#FF5C00]/40 hover:shadow-md cursor-pointer'
    }`}>
      <div className="relative h-28 flex items-center justify-center" style={{ backgroundColor: product.bgColor }}>
        <MaterialIcon name={product.icon} className="select-none text-5xl text-[#374151]" filled />

        {cartQty > 0 && (
          <span className="absolute top-2 left-2 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
            style={{ backgroundColor: '#FF5C00' }}>
            {cartQty}
          </span>
        )}

        {isOut && (
          <span className="absolute top-2 right-2 bg-[#FEE2E2] text-[#991B1B] text-[10px] font-bold px-2 py-0.5 rounded-full">
            Agotado
          </span>
        )}
        {isLow && !isOut && (
          <span className="absolute top-2 right-2 bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold px-2 py-0.5 rounded-full">
            Pocas existencias
          </span>
        )}
      </div>

      <div className="p-3">
        <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wide mb-0.5">{product.category}</p>
        <p className="text-sm font-bold text-[#0D0F14] leading-tight mb-2 line-clamp-2">{product.name}</p>

        <div className="flex items-center justify-between mb-2.5">
          <span className="text-base font-bold" style={{ color: '#FF5C00' }}>{fmt(product.price)}</span>
          <span className={`text-[10px] font-semibold ${
            isOut ? 'text-[#EF4444]' : isLow ? 'text-[#F59E0B]' : 'text-[#10B981]'
          }`}>
            {isOut ? 'Sin existencias' : `${product.stock} disp.`}
          </span>
        </div>

        <button
          onClick={onAdd}
          disabled={isOut || atMax}
          className={`w-full py-1.5 text-sm font-semibold rounded-lg transition-all duration-150 ${
            isOut || atMax
              ? 'bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed'
              : 'text-white hover:opacity-90 active:scale-95'
          }`}
          style={!(isOut || atMax) ? { backgroundColor: '#FF5C00' } : {}}
        >
          {isOut ? 'Agotado' : atMax ? 'Máx. alcanzado' : 'Agregar'}
        </button>
      </div>
    </div>
  );
}
