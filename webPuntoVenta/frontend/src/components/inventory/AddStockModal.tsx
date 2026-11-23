import { useId, useState } from "react";

import type { Product } from "../../types";
import MaterialIcon from "../MaterialIcon";

interface AddStockModalProps {
  product: Product;
  onConfirm: (quantity: number, observations: string) => void;
  onCancel: () => void;
}

export default function AddStockModal({ product, onConfirm, onCancel }: AddStockModalProps) {
  const id = useId();
  const [quantity, setQuantity] = useState("");
  const [observations, setObservations] = useState("");
  const parsedQuantity = Number.parseInt(quantity) || 0;
  const isValid = parsedQuantity > 0;

  return (
    <div className="rx-modal-overlay">
      <div className="rx-modal rx-modal--scroll rx-stock-form" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-subtitle`} onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
        if (event.key === "Tab") {
          const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea");
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
        {/* Encabezado del movimiento de inventario. */}
        <div className="rx-modal-header">
          <div>
            <h2 id={`${id}-title`}>Agregar existencias</h2>
            <p id={`${id}-subtitle`} className="rx-product-detail-subtitle">Entrada de mercancía</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Cerrar" className="rx-modal-close">
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </div>

        <div className="rx-modal-body rx-stock-form-body">
          <div className="rx-card rx-stock-product">
            <div className="rx-stock-product-icon">
              <MaterialIcon name={product.icon} className="text-2xl" />
            </div>
            <div className="rx-stock-product-info">
              <p className="rx-stock-product-name">{product.name}</p>
              <p className="rx-stock-product-meta">{product.code} · {product.category}</p>
            </div>
            <div className="rx-stock-product-count">
              <p className="rx-stock-product-meta">Existencia actual</p>
              <p className="rx-stock-product-value">{product.stock}</p>
            </div>
          </div>

          <label className="rx-field">
            <span className="rx-label">Cantidad a agregar <span className="rx-error-text" aria-hidden="true">*</span></span>
            <input type="number" min="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} autoFocus placeholder="Ej. 20" aria-describedby={`${id}-quantity-help`} className="rx-input rx-stock-quantity" />
            <span id={`${id}-quantity-help`} className="rx-stock-field-help">Indica las unidades que ingresan al inventario.</span>
          </label>

          {isValid && (
            <section className="rx-card rx-stock-preview" aria-label="Resumen de entrada" aria-live="polite">
              <h3 className="rx-label">Resumen</h3>
              <dl>
                <div><dt>Existencia actual</dt><dd>{product.stock} unidades</dd></div>
                <div><dt>Entrada</dt><dd><span className="rx-badge rx-badge--success">+{parsedQuantity}</span></dd></div>
                <div className="rx-stock-preview-total"><dt>Nueva existencia</dt><dd>{product.stock + parsedQuantity} unidades</dd></div>
              </dl>
            </section>
          )}

          <label className="rx-field">
            <span className="rx-label">Observaciones <span className="rx-stock-optional">(opcional)</span></span>
            <textarea value={observations} onChange={(event) => setObservations(event.target.value)} rows={2} placeholder="Ej. Reposición semanal de producto" className="rx-input rx-stock-observations" />
          </label>

        </div>
        <div className="rx-modal-footer">
          <button type="button" onClick={onCancel} className="rx-btn rx-btn--outline">Cancelar</button>
          <button type="button" onClick={() => isValid && onConfirm(parsedQuantity, observations)} disabled={!isValid} className="rx-btn rx-btn--dark">Confirmar entrada</button>
        </div>
      </div>
    </div>
  );
}