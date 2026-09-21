import { useMemo, useState } from "react";

import type { Product } from "../types";
import { CATEGORIES } from "../data";
import MaterialIcon from "./MaterialIcon";

/*
 * Filtros disponibles según el estado de existencia.
 */
type StockFilter =
  | "all"
  | "available"
  | "low"
  | "out"
  | "inactive";

/*
 * Propiedades que recibe la pantalla de Inventario.
 *
 * Las acciones todavía no modifican datos; App decidirá
 * qué hacer cuando se seleccione crear o editar.
 */
interface InventoryPageProps {
  products: Product[];
  onNewProduct: () => void;
  onEditProduct: (product: Product) => void;
}

/*
 * Configuración visual de un estado de producto.
 */
interface StockState {
  label: string;
  className: string;
}

/*
 * Formatea cantidades como moneda mexicana.
 */
const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);

/*
 * Determina el estado visual de cada producto.
 *
 * Orden de prioridad:
 * 1. Inactivo.
 * 2. Agotado.
 * 3. Stock bajo.
 * 4. Disponible.
 */
function getStockState(product: Product): StockState {
  if (product.status === "inactive") {
    return {
      label: "Inactivo",
      className: "bg-[#F3F4F6] text-[#6B7280]",
    };
  }

  if (product.stock === 0) {
    return {
      label: "Agotado",
      className: "bg-[#FEE2E2] text-[#991B1B]",
    };
  }

  if (product.stock <= product.minimumStock) {
    return {
      label: "Stock bajo",
      className: "bg-[#FEF3C7] text-[#92400E]",
    };
  }

  return {
    label: "Disponible",
    className: "bg-[#D1FAE5] text-[#065F46]",
  };
}

/*
 * Determina si un producto coincide con el filtro seleccionado.
 */
function matchesStockFilter(
  product: Product,
  filter: StockFilter,
): boolean {
  switch (filter) {
    case "available":
      return (
        product.status === "active" &&
        product.stock > product.minimumStock
      );

    case "low":
      return (
        product.status === "active" &&
        product.stock > 0 &&
        product.stock <= product.minimumStock
      );

    case "out":
      return (
        product.status === "active" &&
        product.stock === 0
      );

    case "inactive":
      return product.status === "inactive";

    case "all":
    default:
      return true;
  }
}

export default function InventoryPage({
  products,
  onNewProduct,
  onEditProduct,
}: InventoryPageProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [stockFilter, setStockFilter] =
    useState<StockFilter>("all");

  /*
   * useMemo evita repetir los filtros si sus dependencias
   * no han cambiado.
   */
  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        product.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        product.code
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesCategory =
        category === "Todos" ||
        product.category === category;

      const matchesStock = matchesStockFilter(
        product,
        stockFilter,
      );

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStock
      );
    });
  }, [products, search, category, stockFilter]);

  /*
   * Totales utilizados en las tarjetas de resumen.
   */
  const activeProducts = products.filter(
    (product) => product.status === "active",
  ).length;

  const lowStockProducts = products.filter(
    (product) =>
      product.status === "active" &&
      product.stock > 0 &&
      product.stock <= product.minimumStock,
  ).length;

  const outOfStockProducts = products.filter(
    (product) =>
      product.status === "active" &&
      product.stock === 0,
  ).length;

  const totalUnits = products
    .filter((product) => product.status === "active")
    .reduce(
      (total, product) => total + product.stock,
      0,
    );

  return (
    <section className="flex h-full flex-col overflow-hidden bg-[#F0F2F7]">
      {/* Encabezado. */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-7 py-5">
        <div>
          <h1 className="text-2xl font-bold text-[#0D0F14]">
            Inventario de productos
          </h1>

          <p className="mt-1 text-sm text-[#6B7280]">
            Consulta y administra las existencias del negocio.
          </p>
        </div>

        <button
          type="button"
          onClick={onNewProduct}
          className="flex items-center gap-2 rounded-xl bg-[#FF5C00] px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
        >
          <MaterialIcon
            name="add"
            className="text-xl"
          />

          Nuevo producto
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-7">
        {/* Resumen del inventario. */}
        <div className="mb-6 grid grid-cols-4 gap-4">
          <SummaryCard
            title="Productos activos"
            value={activeProducts}
            icon="inventory_2"
            iconClassName="bg-[#DBEAFE] text-[#1D4ED8]"
          />

          <SummaryCard
            title="Unidades disponibles"
            value={totalUnits}
            icon="deployed_code"
            iconClassName="bg-[#D1FAE5] text-[#047857]"
          />

          <SummaryCard
            title="Stock bajo"
            value={lowStockProducts}
            icon="warning"
            iconClassName="bg-[#FEF3C7] text-[#B45309]"
          />

          <SummaryCard
            title="Agotados"
            value={outOfStockProducts}
            icon="remove_shopping_cart"
            iconClassName="bg-[#FEE2E2] text-[#B91C1C]"
          />
        </div>

        {/* Buscador y filtros. */}
        <div className="mb-5 rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <MaterialIcon
                name="search"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl text-[#9CA3AF]"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar por nombre o código..."
                className="w-full rounded-xl border border-[#E5E7EB] py-2.5 pl-11 pr-10 text-sm text-[#0D0F14] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#FF5C00]"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]"
                >
                  <MaterialIcon
                    name="close"
                    className="text-lg"
                  />
                </button>
              )}
            </div>

            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
              aria-label="Filtrar por categoría"
              className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#374151] outline-none focus:border-[#FF5C00]"
            >
              {CATEGORIES.map((categoryOption) => (
                <option
                  key={categoryOption}
                  value={categoryOption}
                >
                  {categoryOption}
                </option>
              ))}
            </select>

            <select
              value={stockFilter}
              onChange={(event) =>
                setStockFilter(
                  event.target.value as StockFilter,
                )
              }
              aria-label="Filtrar por estado de existencia"
              className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm text-[#374151] outline-none focus:border-[#FF5C00]"
            >
              <option value="all">
                Todos los estados
              </option>

              <option value="available">
                Disponibles
              </option>

              <option value="low">
                Stock bajo
              </option>

              <option value="out">
                Agotados
              </option>

              <option value="inactive">
                Inactivos
              </option>
            </select>
          </div>
        </div>

        {/* Tabla de productos. */}
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
            <h2 className="font-bold text-[#0D0F14]">
              Productos
            </h2>

            <span className="text-sm text-[#6B7280]">
              {filteredProducts.length} resultado
              {filteredProducts.length === 1 ? "" : "s"}
            </span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F3F4F6]">
                <MaterialIcon
                  name="search_off"
                  className="text-3xl text-[#9CA3AF]"
                />
              </div>

              <p className="font-semibold text-[#374151]">
                No se encontraron productos
              </p>

              <p className="mt-1 text-sm text-[#9CA3AF]">
                Modifica los filtros o realiza otra búsqueda.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] text-left text-xs uppercase tracking-wide text-[#6B7280]">
                    <th className="px-5 py-3 font-semibold">
                      Producto
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Código
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Categoría
                    </th>

                    <th className="px-4 py-3 text-right font-semibold">
                      Costo
                    </th>

                    <th className="px-4 py-3 text-right font-semibold">
                      Precio
                    </th>

                    <th className="px-4 py-3 text-center font-semibold">
                      Stock
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Estado
                    </th>

                    <th className="px-5 py-3 text-right font-semibold">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E5E7EB]">
                  {filteredProducts.map((product) => {
                    const stockState =
                      getStockState(product);

                    return (
                      <tr
                        key={product.id}
                        className="transition-colors hover:bg-[#FFF9F5]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[#374151]"
                              style={{
                                backgroundColor:
                                  product.bgColor,
                              }}
                            >
                              <MaterialIcon
                                name={product.icon}
                                className="text-2xl"
                                filled
                              />
                            </div>

                            <div>
                              <p className="font-semibold text-[#0D0F14]">
                                {product.name}
                              </p>

                              <p className="text-xs text-[#9CA3AF]">
                                Mínimo:{" "}
                                {product.minimumStock}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-sm font-medium text-[#6B7280]">
                          {product.code}
                        </td>

                        <td className="px-4 py-4 text-sm text-[#374151]">
                          {product.category}
                        </td>

                        <td className="px-4 py-4 text-right text-sm tabular-nums text-[#6B7280]">
                          {formatCurrency(product.cost)}
                        </td>

                        <td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-[#0D0F14]">
                          {formatCurrency(product.price)}
                        </td>

                        <td className="px-4 py-4 text-center">
                          <span className="font-bold tabular-nums text-[#0D0F14]">
                            {product.stock}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${stockState.className}`}
                          >
                            {stockState.label}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                onEditProduct(product)
                              }
                              aria-label={`Editar ${product.name}`}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6B7280] transition-colors hover:bg-[#FFF5F0] hover:text-[#FF5C00]"
                            >
                              <MaterialIcon
                                name="edit"
                                className="text-xl"
                              />
                            </button>
                          </div>
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
    </section>
  );
}

/*
 * Tarjeta reutilizable para las métricas superiores.
 */
interface SummaryCardProps {
  title: string;
  value: number;
  icon: string;
  iconClassName: string;
}

function SummaryCard({
  title,
  value,
  icon,
  iconClassName,
}: SummaryCardProps) {
  return (
    <article className="flex items-center gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-4">
      <div
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
      >
        <MaterialIcon
          name={icon}
          className="text-2xl"
          filled
        />
      </div>

      <div>
        <p className="text-2xl font-bold tabular-nums text-[#0D0F14]">
          {value}
        </p>

        <p className="text-xs font-medium text-[#6B7280]">
          {title}
        </p>
      </div>
    </article>
  );
}
