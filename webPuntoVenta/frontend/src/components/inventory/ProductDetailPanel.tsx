import { useEffect, useId, useRef } from "react";
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
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  const isInactive = product.status === "inactive";
  const isOut = product.stock === 0;
  const isLow = product.stock > 0 && product.stock <= product.minimumStock;
  const statusLabel = isInactive ? "Inactivo" : isOut ? "Agotado" : isLow ? "Stock bajo" : "Disponible";
  const statusIcon = isInactive ? "cancel" : isOut ? "error" : isLow ? "warning" : "check_circle";
  const statusClass = isInactive ? "rx-badge--neutral" : isOut ? "rx-badge--danger" : isLow ? "rx-badge--warning" : "rx-badge--success";
  const stockPercentage = product.minimumStock > 0 ? Math.min((product.stock / (product.minimumStock * 3)) * 100, 100) : 100;
  const stockClass = isOut ? "rx-stock-meter--danger" : isLow ? "rx-stock-meter--warning" : "rx-stock-meter--success";

  return (
    <div className="rx-modal-layer rx-detail-layer">
      <button type="button" tabIndex={-1} aria-label="Cerrar detalles" onClick={onClose} className="rx-modal-backdrop" />
      <aside ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="rx-detail-panel" onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
        if (event.key === "Tab") {
          const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
          const first = buttons?.[0];
          const last = buttons?.[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}>
        <header className="rx-modal-header">
          <div>
            <h2 id={titleId}>Detalle del producto</h2>
            <p className="rx-product-detail-subtitle">Información y disponibilidad</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rx-modal-close"><MaterialIcon name="close" className="text-xl" /></button>
        </header>

        <div className="rx-modal-body rx-product-detail-body">
          <div className="rx-product-identity">
            <div className="rx-product-identity-icon"><MaterialIcon name={product.icon} className="text-4xl" /></div>
            <h3>{product.name}</h3>
            <p className="rx-product-code">{product.code}</p>
            <span className={`rx-badge ${statusClass}`}>
              <MaterialIcon name={statusIcon} className="text-sm" filled />
              {statusLabel}
            </span>
          </div>

          <section className="rx-card rx-detail-card" aria-label="Información del producto">
            <h3 className="rx-label">Información</h3>
            <dl className="rx-detail-info">
              <InfoRow icon="category" label="Categoría" value={product.category} />
              <InfoRow icon="payments" label="Precio de venta" value={formatCurrency(product.price)} />
              <InfoRow icon="sell" label="Costo" value={formatCurrency(product.cost)} />
              {product.description && <div className="rx-detail-description"><dt>Descripción</dt><dd>{product.description}</dd></div>}
            </dl>
          </section>

          <section className="rx-card rx-detail-card" aria-label="Estado de inventario">
            <h3 className="rx-label">Estado de inventario</h3>
            <dl className="rx-stock-summary">
              <div><dt>Existencia actual</dt><dd className="rx-stock-current">{product.stock}</dd></div>
              <div><dt>Stock mínimo</dt><dd>{product.minimumStock}</dd></div>
            </dl>
            <meter className={`rx-stock-meter ${stockClass}`} min={0} max={100} value={stockPercentage} aria-label="Nivel de existencias respecto a tres veces el stock mínimo" aria-valuetext={`${product.stock} unidades; stock mínimo: ${product.minimumStock}`} />
            {isLow && <p className="rx-alert rx-alert--warning"><MaterialIcon name="warning" className="text-lg" />Este producto tiene pocas existencias.</p>}
            {isOut && <p className="rx-alert rx-alert--danger"><MaterialIcon name="error" className="text-lg" />Sin existencias disponibles.</p>}
            {isInactive && <p className="rx-alert"><MaterialIcon name="info" className="text-lg" />Producto inactivo, no disponible en Venta.</p>}
          </section>
        </div>

        <footer className="rx-modal-footer rx-detail-footer">
          <button type="button" onClick={onEdit} className="rx-btn rx-btn--outline rx-btn--block"><MaterialIcon name="edit" className="text-lg" />Editar producto</button>
          <button type="button" onClick={onAddStock} disabled={isInactive} className="rx-btn rx-btn--accent rx-btn--block"><MaterialIcon name="add_box" className="text-lg" />Agregar existencias</button>
        </footer>
      </aside>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <div className="rx-detail-info-row"><dt><MaterialIcon name={icon} className="text-base" /><span>{label}</span></dt><dd>{value}</dd></div>;
}