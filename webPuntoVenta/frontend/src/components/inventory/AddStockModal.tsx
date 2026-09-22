import { useState } from "react";

import type { Product } from "../../types";
import MaterialIcon from "../MaterialIcon";

interface AddStockModalProps {
  product: Product;
  onConfirm: (quantity: number, observations: string) => void;
  onCancel: () => void;
}

export default function AddStockModal({ product, onConfirm, onCancel }: AddStockModalProps) {
  const [quantity, setQuantity] = useState("");
  const [observations, setObservations] = useState("");
  const parsedQuantity = Number.parseInt(quantity) || 0;
  const isValid = parsedQuantity > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="modal-enter w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Encabezado del movimiento de inventario. */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-[#0D0F14]">Agregar existencias</h2>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">Entrada de mercancía</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151]">
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: product.bgColor }}>
              <MaterialIcon name={product.icon} className="text-2xl text-[#374151]" filled />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0D0F14]">{product.name}</p>
              <p className="text-xs text-[#9CA3AF]">{product.code} · {product.category}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-[#9CA3AF]">Existencia actual</p>
              <p className="text-lg font-bold text-[#0D0F14]">{product.stock}</p>
            </div>
          </div>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-[#374151]">Cantidad a agregar <span className="text-[#EF4444]">*</span></span>
            <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} autoFocus placeholder="Ej. 20" className="w-full rounded-xl border-2 border-[#E5E7EB] px-4 py-3 text-xl font-bold text-[#0D0F14] outline-none focus:border-[#FF5C00]" />
          </label>

          {isValid && (
            <div className="mb-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Resumen</p>
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-[#6B7280]">Existencia actual</span><strong>{product.stock} unidades</strong></div>
                <div className="flex justify-between text-[#10B981]"><span>Entrada</span><strong>+{parsedQuantity}</strong></div>
                <div className="flex justify-between border-t border-[#E5E7EB] pt-2"><strong>Nueva existencia</strong><strong>{product.stock + parsedQuantity} unidades</strong></div>
              </div>
            </div>
          )}

          <label className="mb-5 block">
            <span className="mb-1.5 block text-sm font-semibold text-[#374151]">Observaciones <span className="font-normal text-[#9CA3AF]">(opcional)</span></span>
            <textarea value={observations} onChange={(event) => setObservations(event.target.value)} rows={2} placeholder="Ej. Reposición semanal de producto" className="w-full resize-none rounded-xl border-2 border-[#E5E7EB] px-4 py-2.5 text-sm text-[#0D0F14] outline-none focus:border-[#FF5C00]" />
          </label>

          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-[#E5E7EB] py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]">Cancelar</button>
            <button type="button" onClick={() => isValid && onConfirm(parsedQuantity, observations)} disabled={!isValid} className="flex-1 rounded-xl bg-[#FF5C00] py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">Confirmar entrada</button>
          </div>
        </div>
      </div>
    </div>
  );
}