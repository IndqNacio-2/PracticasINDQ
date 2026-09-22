import { useState } from "react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="modal-enter flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Encabezado del formulario. */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[#E5E7EB] px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#0D0F14]">
              {isEditing ? "Editar producto" : "Nuevo producto"}
            </h2>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">
              {isEditing
                ? "Modifica la información del producto"
                : "Completa la información del nuevo producto"}
            </p>
          </div>

          <button type="button" onClick={onCancel} aria-label="Cerrar formulario" className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151]">
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 divide-[#E5E7EB] md:grid-cols-2 md:divide-x">
            <div className="flex flex-col gap-5 p-6">
              <FormSection title="Información general" icon="package_2">
                <FormField label="Nombre del producto" error={errors.name} required>
                  <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Ej. Agua 1 L" className={inputClass(Boolean(errors.name))} />
                </FormField>

                <FormField label="Código" error={errors.code} required>
                  <input value={form.code} onChange={(event) => updateField("code", event.target.value.toUpperCase())} placeholder="Ej. AG-001" className={inputClass(Boolean(errors.code))} />
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

            <div className="flex flex-col gap-5 p-6">
              <FormSection title="Inventario" icon="inventory_2">
                {!isEditing && (
                  <NumberField label="Existencia inicial" value={form.stock} error={errors.stock} onChange={(value) => updateField("stock", value)} required />
                )}
                <NumberField label="Stock mínimo" value={form.minimumStock} error={errors.minimumStock} onChange={(value) => updateField("minimumStock", value)} required />
                <p className="text-xs leading-5 text-[#9CA3AF]">Se mostrará una alerta cuando la existencia sea igual o menor al stock mínimo.</p>
              </FormSection>

              <FormSection title="Apariencia" icon="palette">
                <p className="text-xs text-[#6B7280]">Selecciona un icono y color para el producto.</p>
                <div className="grid grid-cols-4 gap-2">
                  {APPEARANCE_OPTIONS.map((option) => {
                    const isSelected = form.icon === option.icon;
                    return (
                      <button key={option.icon} type="button" onClick={() => setForm((currentForm) => ({ ...currentForm, ...option }))} className={`flex h-12 items-center justify-center rounded-xl border-2 transition-all ${isSelected ? "border-[#FF5C00] shadow-md" : "border-transparent hover:border-[#E5E7EB]"}`} style={{ backgroundColor: option.bgColor }}>
                        <MaterialIcon name={option.icon} className="text-2xl text-[#374151]" filled />
                      </button>
                    );
                  })}
                </div>
              </FormSection>

              <FormSection title="Estado" icon="toggle_on">
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium text-[#374151]">Activo</p>
                    <p className="text-xs text-[#9CA3AF]">El producto estará disponible en el Punto de Venta.</p>
                  </div>
                  <button type="button" onClick={() => updateField("status", form.status === "active" ? "inactive" : "active")} aria-label="Cambiar estado del producto">
                    <MaterialIcon name={form.status === "active" ? "toggle_on" : "toggle_off"} className={`text-4xl ${form.status === "active" ? "text-[#FF5C00]" : "text-[#D1D5DB]"}`} filled />
                  </button>
                </div>
              </FormSection>
            </div>
          </div>
        </div>

        <div className="flex flex-shrink-0 justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
          <button type="button" onClick={onCancel} className="rounded-xl border border-[#E5E7EB] px-5 py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]">Cancelar</button>
          <button type="button" onClick={handleSave} className="rounded-xl bg-[#FF5C00] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">{isEditing ? "Guardar cambios" : "Guardar producto"}</button>
        </div>
      </div>
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return `w-full rounded-lg border px-3 py-2 text-sm text-[#0D0F14] outline-none transition-colors ${hasError ? "border-[#EF4444]" : "border-[#E5E7EB] focus:border-[#FF5C00]"}`;
}

function FormSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2 border-b border-[#F3F4F6] pb-2">
        <MaterialIcon name={icon} className="text-base text-[#9CA3AF]" />
        <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">{title}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function FormField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[#374151]">{label} {required && <span className="text-[#EF4444]">*</span>}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-[#EF4444]">{error}</span>}
    </label>
  );
}

function NumberField({ label, value, error, onChange, required, currency }: { label: string; value: number; error?: string; onChange: (value: number) => void; required?: boolean; currency?: boolean }) {
  return (
    <FormField label={label} error={error} required={required}>
      <div className="relative">
        {currency && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">$</span>}
        <input type="number" min="0" step={currency ? "0.01" : "1"} value={value || ""} onChange={(event) => onChange(Number(event.target.value) || 0)} placeholder="0" className={`${inputClass(Boolean(error))} ${currency ? "pl-7" : ""}`} />
      </div>
    </FormField>
  );
}