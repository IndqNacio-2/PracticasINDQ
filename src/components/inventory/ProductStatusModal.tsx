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
      <div className="modal-enter w-full max-w-sm rounded-[var(--rx-radius-extra-large)] bg-[var(--rx-surface)] p-6 border border-[var(--rx-line)] shadow-[var(--rx-floating-shadow)] max-h-[90vh] overflow-y-auto">
        <div className="mb-6 text-center">
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isActive ? "bg-[var(--rx-danger-bg)]" : "bg-[var(--rx-success-bg)]"}`}>
            <MaterialIcon name={isActive ? "toggle_off" : "toggle_on"} className={`text-3xl ${isActive ? "text-[color:var(--rx-danger)]" : "text-[color:var(--rx-success)]"}`} filled />
          </div>
          <h2 className="mb-2 text-lg font-bold text-[color:var(--rx-ink)]">{isActive ? "Desactivar producto" : "Activar producto"}</h2>
          <p className="mb-1 text-sm font-semibold text-[color:var(--rx-ink-secondary)]">{product.name}</p>
          <p className="text-sm leading-6 text-[color:var(--rx-ink-secondary)]">
            {isActive
              ? "Este producto dejará de estar disponible en el Punto de Venta, pero su información se conservará."
              : "El producto volverá a estar disponible en el Punto de Venta."}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button type="button" onClick={onCancel} className="rx-btn rx-btn--outline rx-btn--block">Cancelar</button>
          <button type="button" onClick={onConfirm} className={`rx-btn rx-btn--block ${isActive ? "rx-btn--danger" : "rx-btn--dark"}`}>{isActive ? "Desactivar producto" : "Activar producto"}</button>
        </div>
      </div>
    </div>
  );
}