import { useEffect, useId, useMemo, useRef, useState } from "react";

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
  const id = useId();
  const productSelect = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    productSelect.current?.focus();
    return () => { previousFocus?.focus(); };
  }, []);

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
    <div className="rx-modal-overlay">
      <div className="rx-modal rx-modal--scroll rx-stock-form rx-waste-form" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-subtitle`} onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
        if (event.key === "Tab") {
          const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)");
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}>
        <div className="rx-modal-header">
          <div>
            <h2 id={`${id}-title`}>Registrar merma</h2>
            <p id={`${id}-subtitle`} className="rx-page-subtitle">Registra la pérdida de un producto del inventario.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Cerrar" className="rx-modal-close"><MaterialIcon name="close" className="text-xl" /></button>
        </div>

        <div className="rx-modal-body rx-stock-form-body">
          <p className="rx-waste-notice"><MaterialIcon name="info" className="text-xl" />Al registrar la merma, las unidades se descontarán del inventario.</p>
          <label className="rx-field">
            <span className="rx-label">Producto *</span>
            <select ref={productSelect} value={productId} onChange={(event) => {
              setProductId(Number(event.target.value));
              setQuantity("");
              setErrors({});
            }} aria-required="true" aria-invalid={Boolean(errors.product)} aria-describedby={errors.product ? `${id}-product-error` : undefined} className={`rx-select ${errors.product ? "rx-input--error" : ""}`}>
              <option value={0}>Selecciona un producto</option>
              {availableProducts.map((product) => <option key={product.id} value={product.id}>{product.code} · {product.name}</option>)}
            </select>
            {errors.product && <span id={`${id}-product-error`} role="alert" className="rx-error-text">{errors.product}</span>}
          </label>
          {availableProducts.length === 0 && <p className="rx-waste-notice">No hay productos activos con existencias disponibles para registrar una merma.</p>}

          {selectedProduct && (
            <div className="rx-card rx-stock-product">
              <span className="rx-stock-product-icon"><MaterialIcon name={selectedProduct.icon} className="text-2xl" /></span>
              <div className="rx-stock-product-info">
                <p className="rx-stock-product-name">{selectedProduct.name}</p>
                <p className="rx-stock-product-meta">{selectedProduct.code} · {selectedProduct.category}</p>
              </div>
              <div className="rx-stock-product-count">
                <p className="rx-stock-product-meta">Existencia actual</p>
                <p className="rx-stock-product-value">{selectedProduct.stock}</p>
              </div>
            </div>
          )}

          <div className="rx-waste-fields">
            <label className="rx-field">
              <span className="rx-label">Cantidad *</span>
              <input type="number" min="1" max={selectedProduct?.stock} value={quantity} onChange={(event) => {
                setQuantity(event.target.value);
                setErrors((currentErrors) => ({ ...currentErrors, quantity: "" }));
              }} placeholder="0" aria-required="true" aria-invalid={Boolean(errors.quantity)} aria-describedby={errors.quantity ? `${id}-quantity-error` : undefined} className={`rx-input rx-stock-quantity ${errors.quantity ? "rx-input--error" : ""}`} />
              {errors.quantity && <span id={`${id}-quantity-error`} role="alert" className="rx-error-text">{errors.quantity}</span>}
            </label>
            <label className="rx-field">
              <span className="rx-label">Motivo *</span>
              <select value={reason} onChange={(event) => setReason(event.target.value as WasteReason)} aria-required="true" className="rx-select">
                {REASON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>

          {selectedProduct && parsedQuantity > 0 && (
            <section className="rx-card rx-stock-preview" aria-label="Vista previa de existencias" aria-live="polite">
              <h3 className="rx-label">Vista previa</h3>
              <dl>
                <div><dt>Existencia actual</dt><dd>{selectedProduct.stock} unidades</dd></div>
                <div><dt>Merma</dt><dd><span className="rx-badge rx-badge--danger">-{parsedQuantity}</span></dd></div>
                <div className="rx-stock-preview-total"><dt>Existencia resultante</dt><dd className={resultingStock <= 0 ? "rx-waste-stock--danger" : resultingStock <= selectedProduct.minimumStock ? "rx-waste-stock--warning" : "rx-waste-stock--success"}>{resultingStock} unidades</dd></div>
              </dl>
              <p className="rx-waste-preview-status">{resultingStock < 0 ? "Stock insuficiente: reduce la cantidad." : resultingStock === 0 ? "El producto quedará agotado." : resultingStock <= selectedProduct.minimumStock ? "El producto quedará con stock bajo." : "El producto conservará existencias disponibles."}</p>
            </section>
          )}

          <label className="rx-field">
            <span className="rx-label">Observaciones <span className="rx-stock-optional">(opcional)</span></span>
            <textarea value={observations} onChange={(event) => setObservations(event.target.value)} rows={3} placeholder="Describe brevemente lo ocurrido" className="rx-input rx-stock-observations" />
          </label>
        </div>

        <div className="rx-modal-footer">
          <button type="button" onClick={onCancel} className="rx-btn rx-btn--outline">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={availableProducts.length === 0} className="rx-btn rx-btn--dark">Registrar merma</button>
        </div>
      </div>
    </div>
  );
}
