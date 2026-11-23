import { useState } from "react";
// Importo el tipo ReactNode de forma explicita en lugar de usar el global React.
import type { ReactNode } from "react";

import type { Product } from "../../types";
import { CATEGORIES } from "../../data";
import MaterialIcon from "../MaterialIcon";

type ProductFormData = Omit<Product, "id">;

const EMPTY_PRODUCT: ProductFormData = {
  code: "",
  name: "",
  description: "",
  category: "Bebidas",
  price: 0,
  cost: 0,
  stock: 0,
  minimumStock: 5,
  status: "active",
  icon: "inventory_2",
  bgColor: "#F3F4F6",
};

// Opciones visuales que puede elegir el usuario para cada producto.
const APPEARANCE_OPTIONS = [
  { icon: "water_drop", bgColor: "#DBEAFE" },
  { icon: "bolt", bgColor: "#FEF3C7" },
  { icon: "local_drink", bgColor: "#D1FAE5" },
  { icon: "fitness_center", bgColor: "#EDE9FE" },
  { icon: "nutrition", bgColor: "#FEE2E2" },
  { icon: "dry_cleaning", bgColor: "#FDF4FF" },
  { icon: "apparel", bgColor: "#ECFDF5" },
  { icon: "inventory_2", bgColor: "#F3F4F6" },
];

interface ProductFormModalProps {
  product?: Product;
  onSave: (product: ProductFormData) => void;
  onCancel: () => void;
}

export default function ProductFormModal({
  product,
  onSave,
  onCancel,
}: ProductFormModalProps) {
  const isEditing = Boolean(product);
  const [form, setForm] = useState<ProductFormData>(
    product ? { ...product } : { ...EMPTY_PRODUCT },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Actualiza un campo y limpia su error al volver a escribir.
  const updateField = <Key extends keyof ProductFormData>(
    key: Key,
    value: ProductFormData[Key],
  ) => {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [key]: "" }));
  };

  const validateForm = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) nextErrors.name = "El nombre es obligatorio.";
    if (!form.code.trim()) nextErrors.code = "El código es obligatorio.";
    if (form.price <= 0) nextErrors.price = "El precio debe ser mayor a cero.";
    if (form.cost < 0) nextErrors.cost = "El costo no puede ser negativo.";
    if (form.stock < 0) nextErrors.stock = "La existencia no puede ser negativa.";
    if (form.minimumStock < 0) nextErrors.minimumStock = "El mínimo no puede ser negativo.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) onSave(form);
  };

  const categories = CATEGORIES.filter((category) => category !== "Todos");

  return (
    <div className="rx-modal-overlay">
      <section className="rx-modal rx-modal--scroll rx-product-form modal-enter" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
        {/* Encabezado del formulario. */}
        <div className="rx-modal-header">
          <div>
            <h2 id="product-form-title" className="rx-modal-title">
              {isEditing ? "Editar producto" : "Nuevo producto"}
            </h2>
            <p className="rx-modal-subtitle rx-modal-subtitle--plain">
              {isEditing
                ? "Modifica la información del producto"
                : "Completa la información del nuevo producto"}
            </p>
          </div>

          <button type="button" onClick={onCancel} aria-label="Cerrar formulario" className="rx-modal-close">
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </div>

        <div className="rx-modal-body">
          <div className="rx-form-columns">
            <div className="rx-form-column">
              <FormSection title="Información general" icon="package_2">
                <FormField label="Nombre del producto" error={errors.name} required>
                  <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Ej. Agua 1 L" aria-invalid={Boolean(errors.name)} className={inputClass(Boolean(errors.name))} />
                </FormField>

                <FormField label="Código" error={errors.code} required>
                  <input value={form.code} onChange={(event) => updateField("code", event.target.value.toUpperCase())} placeholder="Ej. AG-001" aria-invalid={Boolean(errors.code)} className={inputClass(Boolean(errors.code))} />
                </FormField>

                <FormField label="Categoría" required>
                  <select value={form.category} onChange={(event) => updateField("category", event.target.value)} className={inputClass(false)}>
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </FormField>

                <FormField label="Descripción">
                  <textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} rows={2} placeholder="Descripción breve del producto" className={`${inputClass(false)} resize-none`} />
                </FormField>
              </FormSection>

              <FormSection title="Precio" icon="payments">
                <NumberField label="Precio de venta" value={form.price} error={errors.price} onChange={(value) => updateField("price", value)} required currency />
                <NumberField label="Costo del producto" value={form.cost} error={errors.cost} onChange={(value) => updateField("cost", value)} currency />
              </FormSection>
            </div>

            <div className="rx-form-column">
              <FormSection title="Inventario" icon="inventory_2">
                {!isEditing && (
                  <NumberField label="Existencia inicial" value={form.stock} error={errors.stock} onChange={(value) => updateField("stock", value)} required />
                )}
                <NumberField label="Stock mínimo" value={form.minimumStock} error={errors.minimumStock} onChange={(value) => updateField("minimumStock", value)} required />
                <p className="rx-product-form-help">Se mostrará una alerta cuando la existencia sea igual o menor al stock mínimo.</p>
              </FormSection>

              <FormSection title="Apariencia" icon="palette">
                <p className="rx-product-form-help">Selecciona un icono y color para el producto.</p>
                <div className="rx-appearance-options">
                  {APPEARANCE_OPTIONS.map((option) => {
                    const isSelected = form.icon === option.icon;
                    return (
                      <button key={option.icon} type="button" onClick={() => setForm((currentForm) => ({ ...currentForm, ...option }))} aria-label={`Apariencia: ${option.icon}`} aria-pressed={isSelected} className="rx-appearance-option">
                        <MaterialIcon name={option.icon} className="text-2xl" filled />
                      </button>
                    );
                  })}
                </div>
              </FormSection>

              <FormSection title="Estado" icon="toggle_on">
                <div className="rx-status-control">
                  <div>
                    <p className="rx-card-title">{form.status === "active" ? "Activo" : "Inactivo"}</p>
                    <p className="rx-product-form-help">{form.status === "active" ? "El producto estará disponible en el Punto de Venta." : "El producto no estará disponible para la venta."}</p>
                  </div>
                  <button type="button" onClick={() => updateField("status", form.status === "active" ? "inactive" : "active")} role="switch" aria-checked={form.status === "active"} aria-label="Cambiar estado del producto" className="rx-status-switch">
                    <MaterialIcon name={form.status === "active" ? "toggle_on" : "toggle_off"} className="text-4xl" filled />
                  </button>
                </div>
              </FormSection>
            </div>
          </div>
        </div>

        <div className="rx-modal-footer">
          <button type="button" onClick={onCancel} className="rx-btn rx-btn--outline">Cancelar</button>
          <button type="button" onClick={handleSave} className="rx-btn rx-btn--dark">{isEditing ? "Guardar cambios" : "Guardar producto"}</button>
        </div>
      </section>
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return `rx-input${hasError ? " rx-input--error" : ""}`;
}

function FormSection({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <section>
      <div className="rx-form-section-heading">
        <MaterialIcon name={icon} className="text-base" />
        <h3 className="rx-label">{title}</h3>
      </div>
      <div className="rx-stack">{children}</div>
    </section>
  );
}

function FormField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <label className="rx-field">
      <span className="rx-label">{label} {required && <span className="rx-text-danger">*</span>}</span>
      {children}
      {error && <span className="rx-error-text" role="alert">{error}</span>}
    </label>
  );
}

function NumberField({ label, value, error, onChange, required, currency }: { label: string; value: number; error?: string; onChange: (value: number) => void; required?: boolean; currency?: boolean }) {
  return (
    <FormField label={label} error={error} required={required}>
      <div className="rx-input-affix">
        {currency && <span className="rx-input-prefix">$</span>}
        <input type="number" min="0" step={currency ? "0.01" : "1"} value={value || ""} onChange={(event) => onChange(Number(event.target.value) || 0)} placeholder="0" aria-invalid={Boolean(error)} className={`${inputClass(Boolean(error))} ${currency ? "rx-input--currency" : ""}`} />
      </div>
    </FormField>
  );
}