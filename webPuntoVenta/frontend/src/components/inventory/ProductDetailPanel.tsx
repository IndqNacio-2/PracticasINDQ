import type { Product } from "../../types";
import MaterialIcon from "../MaterialIcon";

interface ProductDetailPanelProps {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
  onAddStock: () => void;
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

export default function ProductDetailPanel({ product, onClose, onEdit, onAddStock }: ProductDetailPanelProps) {
  const isInactive = product.status === "inactive";
  const isOut = product.stock === 0;
  const isLow = product.stock > 0 && product.stock <= product.minimumStock;
  const statusLabel = isInactive ? "Inactivo" : isOut ? "Agotado" : isLow ? "Stock bajo" : "Disponible";
  const statusIcon = isInactive ? "cancel" : isOut ? "error" : isLow ? "warning" : "check_circle";
  const statusClass = isInactive ? "bg-[#F3F4F6] text-[#6B7280]" : isOut ? "bg-[#FEF2F2] text-[#991B1B]" : isLow ? "bg-[#FFFBEB] text-[#92400E]" : "bg-[#F0FDF4] text-[#166534]";
  const stockPercentage = product.minimumStock > 0 ? Math.min((product.stock / (product.minimumStock * 3)) * 100, 100) : 100;
  const stockColor = isOut ? "#EF4444" : isLow ? "#F59E0B" : "#10B981";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Cerrar detalles" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <aside className="panel-enter relative flex h-full w-full max-w-[400px] flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[#E5E7EB] px-6 py-5">
          <h2 className="text-lg font-bold text-[#0D0F14]">Detalle del producto</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151]"><MaterialIcon name="close" className="text-xl" /></button>
        </div>

        <div className="flex flex-1 flex-col gap-5 p-6">
          <div className="flex flex-col items-center rounded-2xl p-6 text-center" style={{ backgroundColor: product.bgColor }}>
            <MaterialIcon name={product.icon} className="mb-3 text-6xl text-[#374151]" filled />
            <h3 className="mb-1 text-xl font-bold text-[#0D0F14]">{product.name}</h3>
            <p className="text-sm text-[#6B7280]">{product.code}</p>
            <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}>
              <MaterialIcon name={statusIcon} className="text-sm" filled />
              {statusLabel}
            </span>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Información</p>
            <div className="space-y-3 text-sm">
              <InfoRow icon="category" label="Categoría" value={product.category} />
              <InfoRow icon="payments" label="Precio de venta" value={formatCurrency(product.price)} />
              <InfoRow icon="sell" label="Costo" value={formatCurrency(product.cost)} />
              {product.description && <div className="border-t border-[#E5E7EB] pt-2"><p className="mb-1 text-xs text-[#9CA3AF]">Descripción</p><p className="text-[#374151]">{product.description}</p></div>}
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Estado de inventario</p>
            <div className="mb-3 flex items-end justify-between">
              <div><p className="text-xs text-[#9CA3AF]">Existencia actual</p><p className="text-3xl font-bold text-[#0D0F14]">{product.stock}</p></div>
              <div className="text-right"><p className="text-xs text-[#9CA3AF]">Stock mínimo</p><p className="text-lg font-bold text-[#374151]">{product.minimumStock}</p></div>
            </div>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-[#E5E7EB]"><div className="h-full rounded-full" style={{ width: `${stockPercentage}%`, backgroundColor: stockColor }} /></div>
            {isLow && <p className="text-xs font-medium text-[#F59E0B]">Este producto tiene pocas existencias.</p>}
            {isOut && <p className="text-xs font-medium text-[#EF4444]">Sin existencias disponibles.</p>}
            {isInactive && <p className="text-xs font-medium text-[#6B7280]">Producto inactivo, no disponible en Venta.</p>}
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-col gap-2 border-t border-[#E5E7EB] px-6 py-4">
          <button type="button" onClick={onEdit} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#FF5C00] py-2.5 text-sm font-semibold text-[#FF5C00] hover:bg-[#FFF5F0]"><MaterialIcon name="edit" className="text-lg" />Editar producto</button>
          <button type="button" onClick={onAddStock} disabled={isInactive} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF5C00] py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"><MaterialIcon name="add_box" className="text-lg" />Agregar existencias</button>
        </div>
      </aside>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[#6B7280]"><MaterialIcon name={icon} className="text-base" /><span>{label}</span></div><strong className="text-[#0D0F14]">{value}</strong></div>;
}