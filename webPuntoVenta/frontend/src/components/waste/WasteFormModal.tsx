import { useMemo, useState } from "react";

import type { Product, WasteReason } from "../../types";
import MaterialIcon from "../MaterialIcon";

export interface WasteFormData {
  productId: number;
  quantity: number;
  reason: WasteReason;
  observations: string;
}

interface WasteFormModalProps {
  products: Product[];
  onSave: (waste: WasteFormData) => void;
  onCancel: () => void;
}

const REASON_OPTIONS: Array<{
  value: WasteReason;
  label: string;
}> = [
  { value: "damaged", label: "Producto dañado" },
  { value: "expired", label: "Producto caducado" },
  { value: "broken", label: "Producto roto" },
  { value: "internal-use", label: "Consumo interno" },
  { value: "inventory-error", label: "Error de inventario" },
  { value: "lost", label: "Producto perdido" },
  { value: "other", label: "Otro motivo" },
];

export default function WasteFormModal({
  products,
  onSave,
  onCancel,
}: WasteFormModalProps) {
  const [productId, setProductId] = useState(0);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] =
    useState<WasteReason>("damaged");
  const [observations, setObservations] = useState("");
  const [errors, setErrors] = useState<{
    product?: string;
    quantity?: string;
  }>({});

  // Solamente muestro productos activos y con existencias disponibles.
  const availableProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.status === "active" && product.stock > 0,
      ),
    [products],
  );

  const selectedProduct = products.find(
    (product) => product.id === productId,
  );
  const parsedQuantity = Number.parseInt(quantity) || 0;
  const resultingStock = selectedProduct
    ? selectedProduct.stock - parsedQuantity
    : 0;

  // Valido que exista un producto y que la merma no supere su existencia.
  const validateForm = (): boolean => {
    const nextErrors: typeof errors = {};

    if (!selectedProduct) {
      nextErrors.product = "Selecciona un producto.";
    }

    if (parsedQuantity <= 0) {
      nextErrors.quantity = "La cantidad debe ser mayor a cero.";
    } else if (
      selectedProduct &&
      parsedQuantity > selectedProduct.stock
    ) {
      nextErrors.quantity =
        "La cantidad no puede superar la existencia actual.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm() || !selectedProduct) return;

    onSave({
      productId: selectedProduct.id,
      quantity: parsedQuantity,
      reason,
      observations: observations.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="modal-enter flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Encabezado del formulario de merma. */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[#E5E7EB] px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#0D0F14]">
              Registrar merma
            </h2>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">
              Registra la pérdida de un producto del inventario.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar formulario"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151]"
          >
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-semibold text-[#374151]">
              Producto <span className="text-[#EF4444]">*</span>
            </label>
            <select
              value={productId}
              onChange={(event) => {
                setProductId(Number(event.target.value));
                setQuantity("");
                setErrors({});
              }}
              className={`w-full rounded-xl border-2 bg-white px-4 py-3 text-sm text-[#0D0F14] outline-none ${
                errors.product
                  ? "border-[#EF4444]"
                  : "border-[#E5E7EB] focus:border-[#FF5C00]"
              }`}
            >
              <option value={0}>Selecciona un producto</option>
              {availableProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.code} · {product.name}
                </option>
              ))}
            </select>
            {errors.product && (
              <p className="mt-1 text-xs text-[#EF4444]">
                {errors.product}
              </p>
            )}
          </div>

          {/* Muestro la información del producto que se seleccionó. */}
          {selectedProduct && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <div
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: selectedProduct.bgColor }}
              >
                <MaterialIcon
                  name={selectedProduct.icon}
                  className="text-2xl text-[#374151]"
                  filled
                />
              </div>
              <div>
                <p className="font-bold text-[#0D0F14]">
                  {selectedProduct.name}
                </p>
                <p className="text-xs text-[#9CA3AF]">
                  {selectedProduct.code} · {selectedProduct.category}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-[#9CA3AF]">
                  Existencia actual
                </p>
                <p className="text-xl font-bold text-[#0D0F14]">
                  {selectedProduct.stock}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#374151]">
                Cantidad <span className="text-[#EF4444]">*</span>
              </label>
              <input
                type="number"
                min="1"
                max={selectedProduct?.stock}
                value={quantity}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setErrors((currentErrors) => ({
                    ...currentErrors,
                    quantity: "",
                  }));
                }}
                placeholder="0"
                className={`w-full rounded-xl border-2 px-4 py-3 text-lg font-bold text-[#0D0F14] outline-none ${
                  errors.quantity
                    ? "border-[#EF4444]"
                    : "border-[#E5E7EB] focus:border-[#FF5C00]"
                }`}
              />
              {errors.quantity && (
                <p className="mt-1 text-xs text-[#EF4444]">
                  {errors.quantity}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#374151]">
                Motivo <span className="text-[#EF4444]">*</span>
              </label>
              <select
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value as WasteReason)
                }
                className="w-full rounded-xl border-2 border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#0D0F14] outline-none focus:border-[#FF5C00]"
              >
                {REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Esta vista previa muestra cómo quedaría la existencia. */}
          {selectedProduct && parsedQuantity > 0 && (
            <div className="my-5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#6B7280]">
                Vista previa
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Existencia actual</span>
                  <strong>{selectedProduct.stock} unidades</strong>
                </div>
                <div className="flex justify-between text-[#EF4444]">
                  <span>Merma</span>
                  <strong>-{parsedQuantity}</strong>
                </div>
                <div className="flex justify-between border-t border-[#E5E7EB] pt-2">
                  <strong>Existencia resultante</strong>
                  <strong
                    className={
                      resultingStock < 0
                        ? "text-[#EF4444]"
                        : "text-[#0D0F14]"
                    }
                  >
                    {resultingStock} unidades
                  </strong>
                </div>
              </div>
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-[#374151]">
              Observaciones{" "}
              <span className="font-normal text-[#9CA3AF]">(opcional)</span>
            </span>
            <textarea
              value={observations}
              onChange={(event) => setObservations(event.target.value)}
              rows={3}
              placeholder="Describe brevemente lo ocurrido"
              className="w-full resize-none rounded-xl border-2 border-[#E5E7EB] px-4 py-2.5 text-sm text-[#0D0F14] outline-none focus:border-[#FF5C00]"
            />
          </label>
        </div>

        <div className="flex flex-shrink-0 justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#E5E7EB] px-5 py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-[#FF5C00] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
          >
            Registrar merma
          </button>
        </div>
      </div>
    </div>
  );
}