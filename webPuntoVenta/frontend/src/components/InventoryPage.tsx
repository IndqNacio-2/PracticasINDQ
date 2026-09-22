import { useEffect, useMemo, useRef, useState } from "react";

import type { Product, ToastMessage } from "../types";
import { CATEGORIES } from "../data";
import MaterialIcon from "./MaterialIcon";
import AddStockModal from "./inventory/AddStockModal";
import ProductDetailPanel from "./inventory/ProductDetailPanel";
import ProductFormModal from "./inventory/ProductFormModal";
import ProductStatusModal from "./inventory/ProductStatusModal";

type SortOption = "name" | "price-asc" | "price-desc" | "stock-asc" | "stock-desc";
type QuickFilter = "all" | "active" | "low-stock" | "out" | "inactive";
type ProductVisualState = "available" | "low" | "out" | "inactive";
type ProductStateFilter = "all" | ProductVisualState;
type InventoryModal = "add" | "edit" | "stock" | "status" | "detail" | null;

interface InventoryPageProps {
  products: Product[];
  onUpdateProduct: (product: Product) => void;
  onAddProduct: (product: Omit<Product, "id">) => void;
  addToast: (message: string, type?: ToastMessage["type"]) => void;
}

const formatCurrency = (value: number): string => `$${value.toFixed(2)}`;

// Determina el estado que se muestra en la tabla.
function getProductState(product: Product): ProductVisualState {
  if (product.status === "inactive") return "inactive";
  if (product.stock === 0) return "out";
  if (product.stock <= product.minimumStock) return "low";
  return "available";
}

const STATE_BADGES = {
  available: { label: "Disponible", icon: "check_circle", className: "bg-[#F0FDF4] text-[#166534]" },
  low: { label: "Stock bajo", icon: "warning", className: "bg-[#FFFBEB] text-[#92400E]" },
  out: { label: "Agotado", icon: "error", className: "bg-[#FEF2F2] text-[#991B1B]" },
  inactive: { label: "Inactivo", icon: "cancel", className: "bg-[#F3F4F6] text-[#6B7280]" },
};

export default function InventoryPage({ products, onUpdateProduct, onAddProduct, addToast }: InventoryPageProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [stateFilter, setStateFilter] = useState<ProductStateFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [modal, setModal] = useState<InventoryModal>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const menuAreaRef = useRef<HTMLDivElement>(null);

  // Cierra el menú de acciones cuando se hace clic fuera de la tabla.
  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (menuAreaRef.current && !menuAreaRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  const inventoryTotals = useMemo(() => ({
    active: products.filter((product) => getProductState(product) === "available").length,
    lowStock: products.filter((product) => getProductState(product) === "low").length,
    out: products.filter((product) => getProductState(product) === "out").length,
    inactive: products.filter((product) => getProductState(product) === "inactive").length,
  }), [products]);

  // Aplica los filtros y después ordena una copia de los productos.
  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...products]
      .filter((product) => {
        const state = getProductState(product);
        if (quickFilter === "active" && state !== "available") return false;
        if (quickFilter === "low-stock" && state !== "low") return false;
        if (quickFilter === "out" && state !== "out") return false;
        if (quickFilter === "inactive" && state !== "inactive") return false;
        return true;
      })
      .filter((product) => {
        const matchesSearch = product.name.toLowerCase().includes(normalizedSearch) || product.code.toLowerCase().includes(normalizedSearch);
        const matchesCategory = categoryFilter === "Todas" || product.category === categoryFilter;
        const matchesState = stateFilter === "all" || getProductState(product) === stateFilter;
        return matchesSearch && matchesCategory && matchesState;
      })
      .sort((first, second) => {
        if (sortBy === "price-asc") return first.price - second.price;
        if (sortBy === "price-desc") return second.price - first.price;
        if (sortBy === "stock-asc") return first.stock - second.stock;
        if (sortBy === "stock-desc") return second.stock - first.stock;
        return first.name.localeCompare(second.name, "es", { sensitivity: "base" });
      });
  }, [products, search, categoryFilter, stateFilter, quickFilter, sortBy]);

  const openModal = (nextModal: InventoryModal, product?: Product) => {
    setSelectedProduct(product ?? null);
    setModal(nextModal);
    setOpenMenuId(null);
  };

  const saveProduct = (productData: Omit<Product, "id">) => {
    if (modal === "edit" && selectedProduct) {
      onUpdateProduct({ ...selectedProduct, ...productData });
      addToast("Producto actualizado correctamente", "success");
    } else {
      onAddProduct(productData);
      addToast("Producto guardado correctamente", "success");
    }
    setModal(null);
  };

  const addStock = (quantity: number, observations: string) => {
    if (!selectedProduct) return;
    onUpdateProduct({ ...selectedProduct, stock: selectedProduct.stock + quantity });
    addToast("Existencias actualizadas correctamente", "success");
    if (observations.trim()) console.info(`Observación de inventario: ${observations}`);
    setModal(null);
  };

  const toggleProductStatus = () => {
    if (!selectedProduct) return;
    const nextStatus = selectedProduct.status === "active" ? "inactive" : "active";
    onUpdateProduct({ ...selectedProduct, status: nextStatus });
    addToast(nextStatus === "active" ? "Producto activado correctamente" : "Producto desactivado correctamente", "success");
    setModal(null);
  };

  const quickCards = [
    { key: "active" as const, icon: "check_circle", label: "Productos activos", value: inventoryTotals.active, color: "#10B981" },
    { key: "low-stock" as const, icon: "warning", label: "Stock bajo", value: inventoryTotals.lowStock, color: "#F59E0B" },
    { key: "out" as const, icon: "error", label: "Agotados", value: inventoryTotals.out, color: "#EF4444" },
    { key: "inactive" as const, icon: "cancel", label: "Inactivos", value: inventoryTotals.inactive, color: "#6B7280" },
  ];

  return (
    <section className="flex h-full flex-col overflow-hidden bg-[#F0F2F7]">
      <header className="flex flex-shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-7 py-5">
        <div>
          <h1 className="text-2xl font-bold text-[#0D0F14]">Inventario</h1>
          <p className="mt-0.5 text-sm text-[#6B7280]">Gestiona los productos y existencias del punto de venta.</p>
        </div>
        <button type="button" onClick={() => openModal("add")} className="flex items-center gap-2 rounded-xl bg-[#FF5C00] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 active:scale-[0.98]">
          <MaterialIcon name="add" className="text-xl" />Agregar producto
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-7">
        {/* Estas tarjetas también funcionan como filtros rápidos. */}
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickCards.map((card) => {
            const isSelected = quickFilter === card.key;
            return (
              <button key={card.key} type="button" onClick={() => setQuickFilter(isSelected ? "all" : card.key)} className={`rounded-2xl border bg-white p-4 text-left transition-all hover:shadow-md ${isSelected ? "border-[#FF5C00] shadow-md" : "border-[#E5E7EB]"}`}>
                <div className="mb-3 flex items-center justify-between">
                  <MaterialIcon name={card.icon} className="text-2xl" filled />
                  {isSelected && <span className="rounded-full bg-[#FF5C00] px-2 py-0.5 text-[10px] font-bold text-white">Activo</span>}
                </div>
                <p className="text-3xl font-bold text-[#0D0F14]" style={{ color: card.color }}>{card.value}</p>
                <p className="mt-0.5 text-xs text-[#6B7280]">{card.label}</p>
              </button>
            );
          })}
        </div>

        <div className="mb-4 rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[220px] flex-1">
              <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-[#9CA3AF]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o código..." className="w-full rounded-xl border border-[#E5E7EB] py-2 pl-9 pr-9 text-sm text-[#0D0F14] outline-none placeholder:text-[#9CA3AF] focus:border-[#FF5C00]" />
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]"><MaterialIcon name="close" className="text-base" /></button>}
            </div>

            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filtrar por categoría" className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#374151] outline-none focus:border-[#FF5C00]">
              <option value="Todas">Todas</option>
              {CATEGORIES.filter((category) => category !== "Todos").map((category) => <option key={category} value={category}>{category}</option>)}
            </select>

            <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as ProductStateFilter)} aria-label="Filtrar por estado" className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#374151] outline-none focus:border-[#FF5C00]">
              <option value="all">Todos</option><option value="available">Disponible</option><option value="low">Stock bajo</option><option value="out">Agotado</option><option value="inactive">Inactivo</option>
            </select>

            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)} aria-label="Ordenar productos" className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#374151] outline-none focus:border-[#FF5C00]">
              <option value="name">Nombre A–Z</option><option value="price-asc">Precio: menor a mayor</option><option value="price-desc">Precio: mayor a menor</option><option value="stock-asc">Menor existencia</option><option value="stock-desc">Mayor existencia</option>
            </select>

            <span className="self-center whitespace-nowrap text-xs text-[#9CA3AF]">{filteredProducts.length} resultado{filteredProducts.length === 1 ? "" : "s"}</span>
          </div>
        </div>

        <div ref={menuAreaRef} className="overflow-visible rounded-2xl border border-[#E5E7EB] bg-white">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <MaterialIcon name="inventory_2" className="mb-3 text-5xl text-[#D1D5DB]" />
              <p className="text-sm font-semibold text-[#6B7280]">Sin resultados para esta búsqueda</p>
              <button type="button" onClick={() => { setSearch(""); setCategoryFilter("Todas"); setStateFilter("all"); setQuickFilter("all"); }} className="mt-2 text-sm font-semibold text-[#FF5C00] hover:underline">Limpiar filtros</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead><tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">{["Producto", "Código", "Categoría", "Precio", "Existencia", "Stock mín.", "Estado", "Acciones"].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#6B7280]">{heading}</th>)}</tr></thead>
                <tbody>
                  {filteredProducts.map((product, index) => {
                    const state = getProductState(product);
                    const badge = STATE_BADGES[state];
                    const isMenuOpen = openMenuId === product.id;
                    const stockColor = state === "out" ? "text-[#EF4444]" : state === "low" ? "text-[#F59E0B]" : "text-[#0D0F14]";

                    return (
                      <tr key={product.id} className={`border-b border-[#F3F4F6] transition-colors hover:bg-[#FAFAFA] ${state === "inactive" ? "opacity-60" : ""} ${index === filteredProducts.length - 1 ? "border-none" : ""}`}>
                        <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: product.bgColor }}><MaterialIcon name={product.icon} className="text-xl text-[#374151]" filled /></div><span className="font-semibold text-[#0D0F14]">{product.name}</span></div></td>
                        <td className="px-4 py-3"><span className="rounded bg-[#F3F4F6] px-2 py-1 font-mono text-xs font-semibold text-[#6B7280]">{product.code}</span></td>
                        <td className="px-4 py-3 text-[#6B7280]">{product.category}</td>
                        <td className="px-4 py-3 font-bold text-[#0D0F14]">{formatCurrency(product.price)}</td>
                        <td className={`px-4 py-3 font-bold ${stockColor}`}>{product.stock}</td>
                        <td className="px-4 py-3 text-[#9CA3AF]">{product.minimumStock}</td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${badge.className}`}><MaterialIcon name={badge.icon} className="text-sm" filled />{badge.label}</span></td>
                        <td className="relative px-4 py-3">
                          <button type="button" onClick={() => setOpenMenuId(isMenuOpen ? null : product.id)} aria-label={`Acciones para ${product.name}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151]"><MaterialIcon name="more_vert" className="text-xl" /></button>
                          {isMenuOpen && (
                            <div className="absolute right-4 top-10 z-30 w-48 rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-xl">
                              <MenuAction icon="visibility" label="Ver detalles" onClick={() => openModal("detail", product)} />
                              <MenuAction icon="edit" label="Editar producto" onClick={() => openModal("edit", product)} />
                              <MenuAction icon="add_box" label="Agregar existencias" onClick={() => openModal("stock", product)} disabled={product.status === "inactive"} />
                              <div className="my-1 border-t border-[#F3F4F6]" />
                              <MenuAction icon={product.status === "active" ? "toggle_off" : "toggle_on"} label={product.status === "active" ? "Desactivar" : "Activar"} onClick={() => openModal("status", product)} danger={product.status === "active"} />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {(modal === "add" || modal === "edit") && <ProductFormModal product={modal === "edit" ? selectedProduct ?? undefined : undefined} onSave={saveProduct} onCancel={() => setModal(null)} />}
      {modal === "stock" && selectedProduct && <AddStockModal product={selectedProduct} onConfirm={addStock} onCancel={() => setModal(null)} />}
      {modal === "status" && selectedProduct && <ProductStatusModal product={selectedProduct} onConfirm={toggleProductStatus} onCancel={() => setModal(null)} />}
      {modal === "detail" && selectedProduct && <ProductDetailPanel product={selectedProduct} onClose={() => setModal(null)} onEdit={() => setModal("edit")} onAddStock={() => setModal("stock")} />}
    </section>
  );
}

function MenuAction({ icon, label, onClick, disabled, danger }: { icon: string; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${danger ? "text-[#EF4444] hover:bg-[#FEF2F2]" : "text-[#374151] hover:bg-[#F9FAFB]"}`}>
      <MaterialIcon name={icon} className="text-lg" />{label}
    </button>
  );
}