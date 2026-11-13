import { useMemo, useRef, useState } from "react";

import type { Product, ToastMessage } from "../types";
import { CATEGORIES } from "../data";
import MaterialIcon from "./MaterialIcon";
import AddStockModal from "./inventory/AddStockModal";
import InventoryActionMenu from "./inventory/InventoryActionMenu";
import ProductDetailPanel from "./inventory/ProductDetailPanel";
import ProductFormModal from "./inventory/ProductFormModal";
import ProductStatusModal from "./inventory/ProductStatusModal";
import { exportInventory } from "./inventory/exportInventory";

type SortOption = "name" | "price-asc" | "price-desc" | "stock-asc" | "stock-desc";
type QuickFilter = "all" | "active" | "low-stock" | "out" | "inactive";
type ProductVisualState = "available" | "low" | "out" | "inactive";
type ProductStateFilter = "all" | ProductVisualState;
type InventoryModal = "add" | "edit" | "stock" | "status" | "detail" | null;

interface InventoryPageProps {
  products: Product[];
  /**
   * Cada accion devuelve true cuando el backend confirmo el cambio.
   * Si algo sale mal, el estado principal muestra el error en un toast.
   */
  onUpdateProduct: (product: Product) => Promise<boolean>;
  onAddProduct: (product: Omit<Product, "id">) => Promise<boolean>;
  onAdjustStock: (productId: number, quantity: number) => Promise<boolean>;
  onToggleStatus: (productId: number, status: Product["status"]) => Promise<boolean>;
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
  available: { label: "Disponible", icon: "check_circle", className: "rx-badge--success" },
  low: { label: "Stock bajo", icon: "warning", className: "rx-badge--warning" },
  out: { label: "Agotado", icon: "error", className: "rx-badge--danger" },
  inactive: { label: "Inactivo", icon: "cancel", className: "rx-badge--neutral" },
};

export default function InventoryPage({ products, onUpdateProduct, onAddProduct, onAdjustStock, onToggleStatus, addToast }: InventoryPageProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [stateFilter, setStateFilter] = useState<ProductStateFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [modal, setModal] = useState<InventoryModal>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);

  const hasFilters = search !== "" || categoryFilter !== "Todas" || stateFilter !== "all" || quickFilter !== "all" || sortBy !== "name";
  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("Todas");
    setStateFilter("all");
    setQuickFilter("all");
    setSortBy("name");
    setOpenMenuId(null);
  };

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

  const downloadInventory = () => {
    try {
      exportInventory(products);
      addToast("Descarga iniciada. Captura el inventario físico en las columnas vacías del archivo.", "success");
    } catch {
      addToast("No se pudo exportar el inventario. Intenta nuevamente.", "error");
    }
  };

  /*
   * Guardo el alta o la edicion del producto y espero la confirmacion
   * del backend antes de cerrar el formulario y avisar al usuario.
   */
  const saveProduct = async (productData: Omit<Product, "id">) => {
    const saved = modal === "edit" && selectedProduct
      ? await onUpdateProduct({ ...selectedProduct, ...productData })
      : await onAddProduct(productData);

    if (saved) {
      addToast(
        modal === "edit" ? "Producto actualizado correctamente" : "Producto guardado correctamente",
        "success",
      );
      setModal(null);
    }
  };

  /*
   * Envio el ajuste de existencias (positivo para entrada y negativo
   * para salida) y cierro el modal solamente si el servidor lo acepto.
   */
  const addStock = async (quantity: number, observations: string) => {
    if (!selectedProduct) return;
    const updated = await onAdjustStock(selectedProduct.id, quantity);
    if (updated) {
      addToast("Existencias actualizadas correctamente", "success");
      if (observations.trim()) console.info(`Observación de inventario: ${observations}`);
      setModal(null);
    }
  };

  /*
   * Cambio el estado del producto en la base de datos sin borrarlo:
   * el inactivo deja de aparecer en el punto de venta.
   */
  const toggleProductStatus = async () => {
    if (!selectedProduct) return;
    const nextStatus = selectedProduct.status === "active" ? "inactive" : "active";
    const changed = await onToggleStatus(selectedProduct.id, nextStatus);
    if (changed) {
      addToast(nextStatus === "active" ? "Producto activado correctamente" : "Producto desactivado correctamente", "success");
      setModal(null);
    }
  };

  const quickCards = [
    { key: "active" as const, icon: "check_circle", label: "Productos activos", value: inventoryTotals.active, tone: "success" },
    { key: "low-stock" as const, icon: "warning", label: "Stock bajo", value: inventoryTotals.lowStock, tone: "warning" },
    { key: "out" as const, icon: "error", label: "Agotados", value: inventoryTotals.out, tone: "danger" },
    { key: "inactive" as const, icon: "cancel", label: "Inactivos", value: inventoryTotals.inactive, tone: "neutral" },
  ];

  return (
    <section className="rx-inventory">
      <header className="rx-page-header">
        <div>
          <h1 className="rx-page-title">Inventario</h1>
          <p className="rx-page-subtitle">Gestiona los productos y existencias del punto de venta.</p>
        </div>
        <div className="rx-inventory-header-actions">
          <button type="button" onClick={downloadInventory} disabled={products.length === 0} title="Exportar todo el inventario, sin aplicar los filtros, con columnas vacías para el conteo físico y observaciones" className="rx-btn rx-btn--outline">
            <MaterialIcon name="download" className="text-xl" />Exportar a Excel
          </button>
          <button type="button" onClick={() => openModal("add")} className="rx-btn rx-btn--accent">
            <MaterialIcon name="add" className="text-xl" />Agregar producto
          </button>
        </div>
      </header>

      <div className="rx-inventory-content">
        {/* Estas tarjetas también funcionan como filtros rápidos. */}
        <div className="rx-inventory-kpis" role="group" aria-label="Filtros rápidos de inventario">
          {quickCards.map((card) => {
            const isSelected = quickFilter === card.key;
            return (
              <button key={card.key} type="button" aria-pressed={isSelected} onClick={() => setQuickFilter(isSelected ? "all" : card.key)} className={`rx-inventory-kpi rx-inventory-kpi--${card.tone}`}>
                <span className="rx-inventory-kpi-icon"><MaterialIcon name={card.icon} className="text-2xl" filled /></span>
                <div className="rx-inventory-kpi-copy">
                  <p className="rx-inventory-kpi-value">{card.value}</p>
                  <p className="rx-inventory-kpi-label">{card.label}</p>
                  {isSelected && <span className="rx-badge rx-badge--accent">Filtro activo</span>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="rx-filter-bar">
          <div className="rx-inventory-filters">
            <div className="rx-search">
              <MaterialIcon name="search" className="rx-search-icon text-lg" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar producto por nombre o código" placeholder="Buscar por nombre o código..." className="rx-input" />
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda" className="rx-inventory-clear"><MaterialIcon name="close" className="text-base" /></button>}
            </div>

            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filtrar por categoría" className="rx-input rx-inventory-select">
              <option value="Todas">Todas</option>
              {CATEGORIES.filter((category) => category !== "Todos").map((category) => <option key={category} value={category}>{category}</option>)}
            </select>

            <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as ProductStateFilter)} aria-label="Filtrar por estado" className="rx-input rx-inventory-select">
              <option value="all">Todos</option><option value="available">Disponible</option><option value="low">Stock bajo</option><option value="out">Agotado</option><option value="inactive">Inactivo</option>
            </select>

            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)} aria-label="Ordenar productos" className="rx-input rx-inventory-select">
              <option value="name">Nombre A–Z</option><option value="price-asc">Precio: menor a mayor</option><option value="price-desc">Precio: mayor a menor</option><option value="stock-asc">Menor existencia</option><option value="stock-desc">Mayor existencia</option>
            </select>

            {hasFilters && <button type="button" onClick={clearFilters} className="rx-btn rx-btn--outline">Limpiar filtros</button>}
            <span className="rx-inventory-results" role="status">{filteredProducts.length} resultado{filteredProducts.length === 1 ? "" : "s"}</span>
          </div>
        </div>

        <div className="rx-inventory-list">
          {filteredProducts.length === 0 ? (
            <div className="rx-empty">
              <MaterialIcon name="inventory_2" className="text-5xl" />
              <p>Sin resultados para esta búsqueda</p>
              <button type="button" onClick={clearFilters} className="rx-btn rx-btn--outline">Limpiar filtros</button>
            </div>
          ) : (
            <div className="rx-table-wrap" tabIndex={0} role="region" aria-label="Listado de productos; desplaza horizontalmente para ver todas las columnas">
              <table className="rx-table rx-inventory-table" aria-label="Productos de inventario">
                <thead><tr>{["Producto", "Código", "Categoría", "Precio", "Existencia", "Stock mín.", "Estado", "Acciones"].map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const state = getProductState(product);
                    const badge = STATE_BADGES[state];
                    const isMenuOpen = openMenuId === product.id;
                    const stockColor = state === "out" ? "rx-inventory-stock--danger" : state === "low" ? "rx-inventory-stock--warning" : "";

                    return (
                      <tr key={product.id} className={state === "inactive" ? "rx-inventory-row--inactive" : ""} data-active={isMenuOpen}>
                        <td><div className="rx-inventory-product"><div className="rx-inventory-product-icon"><MaterialIcon name={product.icon} className="text-xl" /></div><span>{product.name}</span></div></td>
                        <td><span className="rx-inventory-code">{product.code}</span></td>
                        <td className="rx-inventory-secondary">{product.category}</td>
                        <td className="rx-inventory-number">{formatCurrency(product.price)}</td>
                        <td className={`rx-inventory-number ${stockColor}`}>{product.stock}</td>
                        <td className="rx-inventory-secondary">{product.minimumStock}</td>
                        <td><span className={`rx-badge ${badge.className}`}><MaterialIcon name={badge.icon} className="text-sm" filled />{badge.label}</span></td>
                        <td className="rx-inventory-actions">
                          <button type="button" onClick={(event) => { menuAnchorRef.current = event.currentTarget; setOpenMenuId(isMenuOpen ? null : product.id); }} aria-expanded={isMenuOpen} aria-controls={isMenuOpen ? `inventory-actions-${product.id}` : undefined} aria-label={`Acciones para ${product.name}`} className="rx-inventory-action-button"><MaterialIcon name="more_vert" className="text-xl" /></button>
                          {isMenuOpen && (
                            <InventoryActionMenu anchor={menuAnchorRef.current} id={`inventory-actions-${product.id}`} label={`Opciones para ${product.name}`} onClose={() => setOpenMenuId(null)}>
                              <MenuAction icon="visibility" label="Ver detalles" onClick={() => openModal("detail", product)} />
                              <MenuAction icon="edit" label="Editar producto" onClick={() => openModal("edit", product)} />
                              <MenuAction icon="add_box" label="Agregar existencias" onClick={() => openModal("stock", product)} disabled={product.status === "inactive"} />
                              <div className="rx-inventory-menu-divider" />
                              <MenuAction icon={product.status === "active" ? "toggle_off" : "toggle_on"} label={product.status === "active" ? "Desactivar" : "Activar"} onClick={() => openModal("status", product)} danger={product.status === "active"} />
                            </InventoryActionMenu>
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
    <button type="button" onClick={onClick} disabled={disabled} className={`rx-inventory-menu-action ${danger ? "rx-inventory-menu-action--danger" : ""}`}>
      <MaterialIcon name={icon} className="text-lg" />{label}
    </button>
  );
}