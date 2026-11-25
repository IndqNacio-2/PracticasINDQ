import type { Product } from "../../types";
import MaterialIcon from "../MaterialIcon";

interface ProductStatusModalProps {
  product: Product;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ProductStatusModal({ product, onConfirm, onCancel }: ProductStatusModalProps) {
  const isActive = product.status === "active";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="modal-enter w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isActive ? "bg-[#FEF2F2]" : "bg-[#F0FDF4]"}`}>
            <MaterialIcon name={isActive ? "toggle_off" : "toggle_on"} className={`text-3xl ${isActive ? "text-[#EF4444]" : "text-[#10B981]"}`} filled />
          </div>
          <h2 className="mb-2 text-lg font-bold text-[#0D0F14]">{isActive ? "Desactivar producto" : "Activar producto"}</h2>
          <p className="mb-1 text-sm font-semibold text-[#374151]">{product.name}</p>
          <p className="text-sm leading-6 text-[#6B7280]">
            {isActive
              ? "Este producto dejará de estar disponible en el Punto de Venta, pero su información se conservará."
              : "El producto volverá a estar disponible en el Punto de Venta."}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button type="button" onClick={onCancel} className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] py-3 font-semibold text-[#374151] hover:bg-[#F3F4F6]">Cancelar</button>
          <button type="button" onClick={onConfirm} className={`w-full rounded-xl py-3 font-bold text-white ${isActive ? "bg-[#EF4444] hover:bg-[#DC2626]" : "bg-[#FF5C00] hover:opacity-90"}`}>{isActive ? "Desactivar producto" : "Activar producto"}</button>
        </div>
      </div>
    </div>
  );
}