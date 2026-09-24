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
   * Recibo true cuando la merma se registra correctamente
   * y false cuando la operación no puede completarse.
   */
  onAddWaste: (waste: WasteFormData) => boolean;
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
    className: "bg-[#FEF3C7] text-[#92400E]",
  },
  expired: {
    label: "Producto caducado",
    icon: "event_busy",
    className: "bg-[#FEE2E2] text-[#991B1B]",
  },
  broken: {
    label: "Producto roto",
    icon: "broken_image",
    className: "bg-[#FEE2E2] text-[#991B1B]",
  },
  "internal-use": {
    label: "Consumo interno",
    icon: "groups",
    className: "bg-[#DBEAFE] text-[#1D4ED8]",
  },
  "inventory-error": {
    label: "Error de inventario",
    icon: "sync_problem",
    className: "bg-[#EDE9FE] text-[#6D28D9]",
  },
  lost: {
    label: "Producto perdido",
    icon: "search_off",
    className: "bg-[#F3F4F6] text-[#4B5563]",
  },
  other: {
    label: "Otro motivo",
    icon: "more_horiz",
    className: "bg-[#F3F4F6] text-[#4B5563]",
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

  const damagedRecords = wasteRecords.filter(
    (record) =>
      record.reason === "damaged" ||
      record.reason === "broken",
  ).length;

  return (
    <section className="flex h-full flex-col overflow-hidden bg-[#F0F2F7]">
      {/* Encabezado del módulo. */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-7 py-5">
        <div>
          <h1 className="text-2xl font-bold text-[#0D0F14]">
            Mermas
          </h1>

          <p className="mt-0.5 text-sm text-[#6B7280]">
            Consulta y registra las pérdidas de productos
            del inventario.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-[#FF5C00] px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
        >
          <MaterialIcon
            name="add"
            className="text-xl"
          />

          Registrar merma
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-7">
        {/* Tarjetas con el resumen de las mermas. */}
        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCard
            title="Registros"
            value={wasteRecords.length.toString()}
            icon="receipt_long"
            iconClassName="bg-[#DBEAFE] text-[#1D4ED8]"
          />

          <SummaryCard
            title="Unidades perdidas"
            value={totalUnits.toString()}
            icon="inventory"
            iconClassName="bg-[#FEF3C7] text-[#B45309]"
          />

          <SummaryCard
            title="Pérdida estimada"
            value={formatCurrency(estimatedLoss)}
            icon="trending_down"
            iconClassName="bg-[#FEE2E2] text-[#B91C1C]"
          />
        </div>

        {/* Barra de búsqueda y filtros. */}
        <div className="mb-4 rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[260px] flex-1">
              <MaterialIcon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-[#9CA3AF]"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar por producto, código o folio..."
                className="w-full rounded-xl border border-[#E5E7EB] py-2.5 pl-9 pr-9 text-sm text-[#0D0F14] outline-none placeholder:text-[#9CA3AF] focus:border-[#FF5C00]"
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
                    className="text-base"
                  />
                </button>
              )}
            </div>

            <select
              value={reasonFilter}
              onChange={(event) =>
                setReasonFilter(
                  event.target.value as
                    | "all"
                    | WasteReason,
                )
              }
              aria-label="Filtrar por motivo"
              className="min-w-[200px] rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#374151] outline-none focus:border-[#FF5C00]"
            >
              <option value="all">
                Todos los motivos
              </option>

              {Object.entries(WASTE_REASONS).map(
                ([value, configuration]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {configuration.label}
                  </option>
                ),
              )}
            </select>

            <span className="self-center whitespace-nowrap text-xs text-[#9CA3AF]">
              {filteredRecords.length} resultado
              {filteredRecords.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Tabla de registros de mermas. */}
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          {filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <MaterialIcon
                name="delete_sweep"
                className="mb-3 text-5xl text-[#D1D5DB]"
              />

              <p className="text-sm font-semibold text-[#6B7280]">
                No se encontraron registros
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setReasonFilter("all");
                }}
                className="mt-2 text-sm font-semibold text-[#FF5C00] hover:underline"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    {[
                      "Folio",
                      "Producto",
                      "Fecha",
                      "Cantidad",
                      "Motivo",
                      "Pérdida",
                      "Registró",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#6B7280]"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map(
                    (record, index) => {
                      const product = findProduct(
                        record.productId,
                      );

                      const reason =
                        WASTE_REASONS[record.reason];

                      const loss =
                        (product?.cost ?? 0) *
                        record.quantity;

                      return (
                        <tr
                          key={record.id}
                          className={`border-b border-[#F3F4F6] transition-colors hover:bg-[#FAFAFA] ${
                            index ===
                            filteredRecords.length - 1
                              ? "border-none"
                              : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className="rounded bg-[#F3F4F6] px-2 py-1 font-mono text-xs font-semibold text-[#6B7280]">
                              {record.folio}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                                style={{
                                  backgroundColor:
                                    product?.bgColor ??
                                    "#F3F4F6",
                                }}
                              >
                                <MaterialIcon
                                  name={
                                    product?.icon ??
                                    "inventory_2"
                                  }
                                  className="text-xl text-[#374151]"
                                  filled
                                />
                              </div>

                              <div>
                                <p className="font-semibold text-[#0D0F14]">
                                  {product?.name ??
                                    "Producto no disponible"}
                                </p>

                                <p className="text-xs text-[#9CA3AF]">
                                  {product?.code ?? "Sin código"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-[#6B7280]">
                            {formatDate(record.createdAt)}
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-bold text-[#EF4444]">
                              -{record.quantity}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${reason.className}`}
                            >
                              <MaterialIcon
                                name={reason.icon}
                                className="text-sm"
                                filled
                              />

                              {reason.label}
                            </span>
                          </td>

                          <td className="px-4 py-3 font-semibold text-[#0D0F14]">
                            {formatCurrency(loss)}
                          </td>

                          <td className="px-4 py-3 text-[#6B7280]">
                            {record.registeredBy}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Este dato se calcula para utilizarlo después
            en filtros y reportes del módulo. */}
        <span className="sr-only">
          {damagedRecords} registros dañados
        </span>
      </div>

      {isFormOpen && (
        <WasteFormModal
          products={products}
          onSave={(waste) => {
            /*
            * Intento registrar la merma desde el estado principal.
            */
            const wasRegistered = onAddWaste(waste);

            /*
            * Solamente cierro el formulario cuando el registro
            * y el descuento de inventario fueron correctos.
            */
            if (wasRegistered) {
              setIsFormOpen(false);
            }
          }}
          onCancel={() => setIsFormOpen(false)}
        />
      )}
    </section>
  );
}

/*
 * Reutilizo esta tarjeta para mostrar los totales
 * principales del módulo.
 */
function SummaryCard({
  title,
  value,
  icon,
  iconClassName,
}: {
  title: string;
  value: string;
  icon: string;
  iconClassName: string;
}) {
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
        <p className="text-2xl font-bold text-[#0D0F14]">
          {value}
        </p>

        <p className="text-xs font-medium text-[#6B7280]">
          {title}
        </p>
      </div>
    </article>
  );
}
