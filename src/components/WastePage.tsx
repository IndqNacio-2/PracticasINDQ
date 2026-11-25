import { useMemo, useState } from "react";

import type {
  Product,
  WasteReason,
  WasteRecord,
} from "../types";

import MaterialIcon from "./MaterialIcon";
import WasteFormModal, {
  type WasteFormData,
} from "./waste/WasteFormModal";

/*
 * Defino la información que recibe el módulo de Mermas.
 */
interface WastePageProps {
  products: Product[];
  wasteRecords: WasteRecord[];
  /*
   * Espero true cuando la merma se registra correctamente en la
   * base de datos y false cuando la operación no puede completarse.
   */
  onAddWaste: (waste: WasteFormData) => Promise<boolean>;
}

/*
 * Mantengo en un solo lugar los nombres e iconos
 * utilizados para cada motivo.
 */
const WASTE_REASONS: Record<
  WasteReason,
  {
    label: string;
    icon: string;
    className: string;
  }
> = {
  damaged: {
    label: "Producto dañado",
    icon: "warning",
    className: "rx-badge--warning",
  },
  expired: {
    label: "Producto caducado",
    icon: "event_busy",
    className: "rx-badge--danger",
  },
  broken: {
    label: "Producto roto",
    icon: "broken_image",
    className: "rx-badge--danger",
  },
  "internal-use": {
    label: "Consumo interno",
    icon: "groups",
    className: "rx-badge--neutral",
  },
  "inventory-error": {
    label: "Error de inventario",
    icon: "sync_problem",
    className: "rx-badge--neutral",
  },
  lost: {
    label: "Producto perdido",
    icon: "search_off",
    className: "rx-badge--neutral",
  },
  other: {
    label: "Otro motivo",
    icon: "more_horiz",
    className: "rx-badge--neutral",
  },
};

/*
 * Formateo cantidades como moneda mexicana.
 */
const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);

/*
 * Formateo la fecha para mostrarla de forma legible.
 */
const formatDate = (value: string): string =>
  new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function WastePage({
  products,
  wasteRecords,
  onAddWaste,
}: WastePageProps) {
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] =
    useState<"all" | WasteReason>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);

  /*
   * Busco el producto relacionado con cada registro.
   */
  const findProduct = (productId: number) =>
    products.find((product) => product.id === productId);

  /*
   * Filtro por folio, nombre, código y motivo.
   * Después ordeno los registros más recientes primero.
   */
  const filteredRecords = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return wasteRecords
      .filter((record) => {
        const product = products.find(
          (item) => item.id === record.productId,
        );

        const matchesSearch =
          record.folio
            .toLowerCase()
            .includes(normalizedSearch) ||
          product?.name
            .toLowerCase()
            .includes(normalizedSearch) ||
          product?.code
            .toLowerCase()
            .includes(normalizedSearch);

        const matchesReason =
          reasonFilter === "all" ||
          record.reason === reasonFilter;

        return matchesSearch && matchesReason;
      })
      .sort(
        (firstRecord, secondRecord) =>
          new Date(secondRecord.createdAt).getTime() -
          new Date(firstRecord.createdAt).getTime(),
      );
  }, [
    wasteRecords,
    products,
    search,
    reasonFilter,
  ]);

  /*
   * Calculo los totales que aparecen en las tarjetas.
   */
  const totalUnits = wasteRecords.reduce(
    (total, record) => total + record.quantity,
    0,
  );

  const estimatedLoss = wasteRecords.reduce(
    (total, record) => {
      const product = findProduct(record.productId);

      return total +
        (product?.cost ?? 0) * record.quantity;
    },
    0,
  );

  const hasFilters = search.trim() !== "" || reasonFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setReasonFilter("all");
  };

  return (
    <section className="rx-page rx-waste">
      <header className="rx-page-header">
        <div>
          <h1 className="rx-page-title">Mermas</h1>
          <p className="rx-page-subtitle">Consulta y registra las pérdidas de productos del inventario.</p>
        </div>
        <button type="button" onClick={() => setIsFormOpen(true)} className="rx-btn rx-btn--accent">
          <MaterialIcon name="add" className="text-xl" />
          Registrar merma
        </button>
      </header>

      <div className="rx-page-content rx-waste-content">
        <section className="rx-waste-kpis" aria-label="Resumen de mermas">
          <SummaryCard title="Registros" value={wasteRecords.length.toString()} icon="receipt_long" tone="neutral" />
          <SummaryCard title="Unidades perdidas" value={totalUnits.toString()} icon="inventory" tone="warning" />
          <SummaryCard title="Pérdida estimada" value={formatCurrency(estimatedLoss)} icon="trending_down" tone="danger" />
        </section>

        <div className="rx-filter-bar">
          <div className="rx-filter-row">
            <label className="rx-search">
              <MaterialIcon name="search" className="rx-search-icon" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por producto, código o folio" aria-label="Buscar por producto, código o folio" className="rx-input" />
            </label>
            <select value={reasonFilter} onChange={(event) => setReasonFilter(event.target.value as "all" | WasteReason)} aria-label="Filtrar por motivo" className="rx-select rx-filter-select">
              <option value="all">Todos los motivos</option>
              {Object.entries(WASTE_REASONS).map(([value, configuration]) => (
                <option key={value} value={value}>{configuration.label}</option>
              ))}
            </select>
            {hasFilters && <button type="button" onClick={clearFilters} className="rx-btn rx-btn--outline">Limpiar filtros</button>}
            <span className="rx-waste-results" role="status">{filteredRecords.length} resultado{filteredRecords.length === 1 ? "" : "s"}</span>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="rx-card rx-table-empty">
            <span className="rx-table-empty-icon"><MaterialIcon name="delete_sweep" className="text-3xl" /></span>
            <h2 className="rx-table-empty-title">{hasFilters ? "No se encontraron registros" : "Aún no hay mermas registradas"}</h2>
            <p className="rx-page-subtitle">{hasFilters ? "Prueba con otra búsqueda o cambia el motivo." : "Los registros de pérdida de inventario aparecerán aquí."}</p>
            <button type="button" onClick={hasFilters ? clearFilters : () => setIsFormOpen(true)} className={`rx-btn ${hasFilters ? "rx-btn--outline" : "rx-btn--accent"}`}>
              {hasFilters ? "Limpiar filtros" : "Registrar merma"}
            </button>
          </div>
        ) : (
          <div className="rx-table-wrap" role="region" aria-label="Historial de mermas" tabIndex={0}>
            <table className="rx-table rx-waste-table">
              <caption className="sr-only">Historial de pérdidas de inventario, ordenado del registro más reciente al más antiguo</caption>
              <thead>
                <tr>{["Folio", "Producto", "Fecha", "Cantidad", "Motivo", "Pérdida", "Registró"].map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => {
                  const product = findProduct(record.productId);
                  const reason = WASTE_REASONS[record.reason];
                  const loss = (product?.cost ?? 0) * record.quantity;
                  return (
                    <tr key={record.id}>
                      <td><span className="rx-badge rx-badge--neutral font-mono">{record.folio}</span></td>
                      <td>
                        <div className="rx-table-product">
                          <span className="rx-table-product-icon rx-waste-product-icon"><MaterialIcon name={product?.icon ?? "inventory_2"} className="text-xl" /></span>
                          <div className="rx-waste-product-info">
                            <p className="rx-table-product-name">{product?.name ?? "Producto no disponible"}</p>
                            <p className="rx-waste-meta">{product?.code ?? "Sin código"}</p>
                          </div>
                        </div>
                      </td>
                      <td><time dateTime={record.createdAt} className="rx-waste-meta">{formatDate(record.createdAt)}</time></td>
                      <td><span className="rx-waste-quantity">-{record.quantity}</span></td>
                      <td><span className={`rx-badge ${reason.className}`}><MaterialIcon name={reason.icon} className="text-sm" />{reason.label}</span></td>
                      <td className="rx-waste-number">{formatCurrency(loss)}</td>
                      <td><span className="rx-waste-meta">{record.registeredBy}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isFormOpen && (
        <WasteFormModal products={products} onSave={async (waste) => {
          // Cierro únicamente después de confirmar el registro y el descuento de inventario.
          const wasRegistered = await onAddWaste(waste);
          if (wasRegistered) setIsFormOpen(false);
        }} onCancel={() => setIsFormOpen(false)} />
      )}
    </section>
  );
}

function SummaryCard({ title, value, icon, tone }: {
  title: string;
  value: string;
  icon: string;
  tone: "neutral" | "warning" | "danger";
}) {
  return (
    <article className={`rx-card rx-waste-kpi rx-waste-kpi--${tone}`}>
      <span className="rx-waste-kpi-icon"><MaterialIcon name={icon} className="text-2xl" /></span>
      <div>
        <p className="rx-waste-kpi-value">{value}</p>
        <p className="rx-kpi-label">{title}</p>
      </div>
    </article>
  );
}
