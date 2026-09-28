import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import type {
  Product,
  SaleRecord,
  WasteRecord,
  WasteReason,
} from "../types";
import MaterialIcon from "./MaterialIcon";

/**
 * Defino la informacion que el modulo de reportes
 * recibe desde el componente principal
 */
interface ReportsPageProps {
    // Recibo el historial completo de venta de la sesion
    sales: SaleRecord[];

    // Recibo los registros de mermas para calcular las perdidas
    wasteRecords: WasteRecord[];

    // Recibo los productos para consultar el costo de cada merma
    products: Product[];
}

// Formateo los importes como moneda mexicana
const formatCurrency = (value: number): string =>
    new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
    }).format(value);

/**
 * Formateo las cantidades de unidades con separador de miles
 * 
 * las unidades son numeros enteros, asi que no necesito decimales
 */
const formatUnits = (value: number): string =>
    new Intl.NumberFormat("es-MX").format(value);

/**
 * Escribo la cantidad junto con su palabra en singular o plural
 * para que los textos del reporte se lean correctamente
 */
const formatCount = (
    value: number,
    singular: string,
    plural: string,
): string => `${formatUnits(value)} ${value === 1 ? singular : plural}`;

/**
 * Redondeo los importes a dos decimales para que los totales del 
 * reporte coincidan exactamente con los del corte de caja
 */
const roundCurrency = (value: number): number =>
    Math.round(value * 100) / 100;

/*
 * Calculo el porcentaje que representa un valor dentro de un total.
 *
 * Devuelvo cero cuando el total también es cero para evitar mostrar
 * NaN dentro de las barras comparativas del reporte.
 */
const toPercent = (value: number, total: number): number =>
    total > 0 ? Math.round((value / total) * 100) : 0;

/*
 * Cuento las unidades que incluye una venta sumando las cantidades
 * de todos los artículos que se cobraron.
 */
const countSaleUnits = (sale: SaleRecord): number =>
    sale.items.reduce((sum, item) => sum + item.qty, 0);

/*
 * Obtengo el costo unitario del producto relacionado con una merma.
 *
 * Devuelvo cero cuando el producto ya no existe para no romper el
 * cálculo de la pérdida estimada.
 */
const getWasteUnitCost = (
    record: WasteRecord,
    products: Product[],
): number =>
    products.find((product) => product.id === record.productId)?.cost ?? 0;

/*
 * Convierto la fecha de una venta al formato comparable "2026-09-24".
 *
 * Las ventas guardan la fecha con toLocaleDateString("es-MX"), o sea
 * "24/9/2026". Como el día y el mes pueden venir sin cero a la
 * izquierda, completo cada parte para poder comparar las fechas
 * como texto.
 */
const toSaleDateKey = (date: string): string => {
    const parts = date.split("/");

    if (parts.length !== 3) {
        return "";
    }

    const [day, month, year] = parts;

    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

/*
 * Convierto la fecha ISO de una merma a la misma clave comparable.
 *
 * Las mermas guardan createdAt con toISOString(), o sea
 * "2026-09-24T18:32:11.123Z". Uso los componentes locales de la fecha
 * para que coincida con el día que vio el usuario al registrar la
 * merma y no con la fecha en horario universal.
 */
const toTimestampDateKey = (value: string): string => {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return "";
    }

    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");

    return `${parsed.getFullYear()}-${month}-${day}`;
};

/*
 * Relaciono cada método de pago con el nombre que ya utiliza
 * el módulo de Corte de caja para que los dos nombren igual.
 */
const PAYMENT_METHOD_LABELS: Record<
    SaleRecord["paymentMethod"],
    string
> = {
    efectivo: "Efectivo",
    tarjeta: "Tarjeta",
    transferencia: "Transferencia",
};

/*
 * Relaciono cada método de pago con un icono para identificarlo
 * fácilmente en la tabla y en el desglose.
 */
const PAYMENT_METHOD_ICONS: Record<
    SaleRecord["paymentMethod"],
    string
> = {
    efectivo: "payments",
    tarjeta: "credit_card",
    transferencia: "account_balance",
};

/*
 * Asigno un color a cada método de pago para pintar las barras
 * comparativas del desglose.
 */
const PAYMENT_METHOD_BAR_CLASSES: Record<
    SaleRecord["paymentMethod"],
    string
> = {
    efectivo: "bg-[#FF5C00]",
    tarjeta: "bg-[#6D28D9]",
    transferencia: "bg-[#1D4ED8]",
};

/*
 * Mantengo el orden de los métodos de pago para recorrerlos
 * siempre igual en el desglose.
 */
const PAYMENT_METHODS: Array<SaleRecord["paymentMethod"]> = [
    "efectivo",
    "tarjeta",
    "transferencia",
];

/*
 * Relaciono cada motivo de merma con el nombre que ya muestra
 * el módulo de Mermas.
 */
const WASTE_REASON_LABELS: Record<WasteReason, string> = {
    damaged: "Producto dañado",
    expired: "Producto caducado",
    broken: "Producto roto",
    "internal-use": "Consumo interno",
    "inventory-error": "Error de inventario",
    lost: "Producto perdido",
    other: "Otro motivo",
};

/*
 * Relaciono cada motivo de merma con el icono que ya utiliza
 * el módulo de Mermas.
 */
const WASTE_REASON_ICONS: Record<WasteReason, string> = {
    damaged: "warning",
    expired: "event_busy",
    broken: "broken_image",
    "internal-use": "groups",
    "inventory-error": "sync_problem",
    lost: "search_off",
    other: "more_horiz",
};

/*
 * Relaciono cada motivo de merma con el color de su barra comparativa.
 *
 * Reutilizo los tonos que el módulo de Mermas ya usa en cada motivo
 * para que las dos pantallas se lean igual.
 */
const WASTE_REASON_BAR_CLASSES: Record<WasteReason, string> = {
    damaged: "bg-[#F59E0B]",
    expired: "bg-[#DC2626]",
    broken: "bg-[#DC2626]",
    "internal-use": "bg-[#1D4ED8]",
    "inventory-error": "bg-[#6D28D9]",
    lost: "bg-[#6B7280]",
    other: "bg-[#6B7280]",
};

/*
 * Reutilizo los mismos estilos de icono que el módulo de Mermas usa
 * para identificar cada motivo.
 */
const WASTE_REASON_ICON_CLASSES: Record<WasteReason, string> = {
    damaged: "bg-[#FEF3C7] text-[#92400E]",
    expired: "bg-[#FEE2E2] text-[#991B1B]",
    broken: "bg-[#FEE2E2] text-[#991B1B]",
    "internal-use": "bg-[#DBEAFE] text-[#1D4ED8]",
    "inventory-error": "bg-[#EDE9FE] text-[#6D28D9]",
    lost: "bg-[#F3F4F6] text-[#4B5563]",
    other: "bg-[#F3F4F6] text-[#4B5563]",
};

/*
 * Recorro los motivos de merma en un orden fijo para que los reportes
 * comparativos siempre se lean de la misma forma.
 *
 * Declaro el arreglo a mano en lugar de usar Object.keys porque así el
 * orden no depende de cómo quedaron escritas las etiquetas.
 */
const WASTE_REASONS: WasteReason[] = [
    "damaged",
    "expired",
    "broken",
    "internal-use",
    "inventory-error",
    "lost",
    "other",
];

// Limito el ranking de productos para que el reporte se lea rápido.
const MAX_TOP_PRODUCTS = 6;

/*
 * Reutilizo esta fila para mostrar cada dato del periodo
 * sin repetir la misma estructura
 */
function ReportRow({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 py-2 ${
        emphasized ? "border-t border-[#E5E7EB]" : ""
      }`}
    >
      <p
        className={`text-sm ${
          emphasized
            ? "font-bold text-[#0D0F14]"
            : "text-[#6B7280]"
        }`}
      >
        {label}
      </p>

      <p
        className={`flex-shrink-0 tabular-nums ${
          emphasized
            ? "text-base font-bold text-[#0D0F14]"
            : "text-sm font-semibold text-[#374151]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/*
 * Reutilizo esta tarjeta para mostrar cada indicador
 * del resumen sin repetir la misma estructura
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
    <article className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
      <div
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${iconClassName}`}
      >
        <MaterialIcon
          name={icon}
          className="text-xl"
          filled
        />
      </div>

      <p className="truncate text-xl font-bold tabular-nums text-[#0D0F14]">
        {value}
      </p>

      <p className="mt-1 text-xs font-medium text-[#6B7280]">
        {title}
      </p>
    </article>
  );
}

/*
 * Reutilizo esta sección para agrupar cada reporte sin repetir
 * el mismo encabezado en todos
 */
function ReportSection({
  title,
  description,
  icon,
  iconClassName,
  children,
}: {
  title: string;
  description: string;
  icon: string;
  iconClassName: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
      <div className="flex items-center gap-3 border-b border-[#E5E7EB] px-5 py-4">
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
        >
          <MaterialIcon name={icon} className="text-xl" filled />
        </div>

        <div>
          <h2 className="font-bold text-[#0D0F14]">{title}</h2>

          <p className="text-xs text-[#9CA3AF]">{description}</p>
        </div>
      </div>

      {children}
    </div>
  );
}

/*
 * Reutilizo esta fila para mostrar un concepto del reporte junto con
 * su barra comparativa
 *
 * Calculo el ancho de la barra con un estilo en línea porque Tailwind
 * no puede leer clases que se construyen con valores dinámicos
 */
function BarRow({
  label,
  detail,
  value,
  percent,
  barClassName,
  icon,
  iconClassName = "bg-[#F3F4F6] text-[#6B7280]",
}: {
  label: string;
  detail: string;
  value: string;
  percent: number;
  barClassName: string;
  icon?: string;
  iconClassName?: string;
}) {
  return (
    <div className="border-b border-[#F3F4F6] px-5 py-3.5 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <div
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
            >
              <MaterialIcon name={icon} className="text-base" filled />
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#0D0F14]">
              {label}
            </p>

            <p className="truncate text-xs text-[#9CA3AF]">{detail}</p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-3">
          <span className="text-sm font-bold tabular-nums text-[#0D0F14]">
            {value}
          </span>

          <span className="w-10 text-right text-xs font-semibold tabular-nums text-[#9CA3AF]">
            {percent}%
          </span>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[#F3F4F6]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barClassName}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/*
 * Reutilizo este estado vacío dentro de las secciones que no
 * encontraron información con los filtros aplicados
 */
function EmptySection({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <MaterialIcon name={icon} className="text-3xl text-[#CBD5E1]" />

      <p className="text-sm text-[#9CA3AF]">{message}</p>
    </div>
  );
}

export default function ReportsPage({
    sales,
    wasteRecords,
    products,
}: ReportsPageProps) {
    /*
     * Guardo los filtros que el usuario aplica al reporte.
     *
     * Uso una cadena vacía mientras no se elige una fecha porque los
     * campos de tipo date devuelven "" cuando están sin llenar.
     */
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [methodFilter, setMethodFilter] = useState<
        "all" | SaleRecord["paymentMethod"]
    >("all");

    /*
     * Aplico el rango de fechas y el método de pago sobre las ventas.
     *
     * Comparo las fechas como texto porque la clave "2026-09-24" tiene
     * el año al inicio, así que el orden alfabético coincide con el
     * orden cronológico y no necesito convertir nada a Date.
     */
    const filteredSales = useMemo(
        () =>
            sales.filter((sale) => {
                const dateKey = toSaleDateKey(sale.date);

                const matchesFromDate =
                    fromDate === "" ||
                    (dateKey !== "" && dateKey >= fromDate);

                const matchesToDate =
                    toDate === "" ||
                    (dateKey !== "" && dateKey <= toDate);

                const matchesMethod =
                    methodFilter === "all" ||
                    sale.paymentMethod === methodFilter;

                return (
                    matchesFromDate && matchesToDate && matchesMethod
                );
            }),
        [sales, fromDate, toDate, methodFilter],
    );

    /*
     * Aplico el rango de fechas sobre las mermas.
     *
     * No aplico el filtro de método de pago porque una merma no se
     * cobra: siempre representa una pérdida de inventario.
     */
    const filteredWasteRecords = useMemo(
        () =>
            wasteRecords.filter((record) => {
                const dateKey = toTimestampDateKey(record.createdAt);

                const matchesFromDate =
                    fromDate === "" ||
                    (dateKey !== "" && dateKey >= fromDate);

                const matchesToDate =
                    toDate === "" ||
                    (dateKey !== "" && dateKey <= toDate);

                return matchesFromDate && matchesToDate;
            }),
        [wasteRecords, fromDate, toDate],
    );

    // Marco con una bandera si el usuario ya aplicó algún filtro.
    const hasFiltersApplied =
        fromDate !== "" || toDate !== "" || methodFilter !== "all";

    /*
     * Aviso cuando el rango de fechas está invertido porque en ese
     * caso el reporte no puede encontrar ninguna operación.
     */
    const hasInvalidRange =
        fromDate !== "" && toDate !== "" && fromDate > toDate;

    // Devuelvo los filtros a su estado inicial.
    const clearFilters = () => {
        setFromDate("");
        setToDate("");
        setMethodFilter("all");
    };

    /**
     * calculo de un solo lugar todos los indicadores del resumen
     * 
     * uso UseMemo para que los totales solamente se recalculen cuando
     * cambian las ventas, las mermas o los productos, y no cada vez que
     * el usuario cambia de modulo o escribe en otra pantalla
     */
    const summary = useMemo(() => {
        // cuento las ventas registradas en el periodo consultado
        const salesCount = filteredSales.length;

        /**
         * sumo el importe de cada venta y lo redondeo para evitar
         * pequeñas diferencias por los decimales de javaScript 
         */
        const totalSales = roundCurrency(
            filteredSales.reduce((sum, sale) => sum + sale.total, 0),
        );

        /**
         * sumo las unidades de todos los articulos vendidos
         * 
         * cada venta guarda sus articulos en items, asi que primero
         * recorro las ventas y despues los articulos de cada venta
         */
        const totalUnits = filteredSales.reduce(
            (sum, sale) => sum + countSaleUnits(sale),
            0,
        );

        /**
         * calcula el ticket promedio dividiendo el importe vendido
         * entre las ventas registradas
         * 
         * compruebo que exista al menos una venta para no dividir entre cero
         */
        const averageTicket =
            salesCount > 0 ? roundCurrency(totalSales / salesCount) : 0;

        /**
         * Estimo la perdida por mermas multiplicando el costo del producto
         * por las unidades registradas como perdida
         * 
         * cuando el producto ya no existe usa cero para no romper el total
         */
        const estimatedLoss = roundCurrency(
            filteredWasteRecords.reduce(
                (sum, record) =>
                    sum +
                    getWasteUnitCost(record, products) *
                        record.quantity,
                0,
            ),
        );

        // cuento las unidades perdidas por mermas
        const wasteUnits = filteredWasteRecords.reduce(
            (sum, record) => sum + record.quantity,
            0,
        );

        return {
            salesCount,
            totalSales,
            totalUnits,
            averageTicket,
            estimatedLoss,
            wasteUnits,
        };
    }, [filteredSales, filteredWasteRecords, products]);

    /**
     * Construyo los reportes comparativos del periodo consultado.
     *
     * Agrupo la información en listas ya ordenadas y con su porcentaje
     * calculado para que el marcado solamente tenga que recorrerlas:
     * el desglose por forma de pago, los productos más vendidos y las
     * mermas por motivo y por producto.
     *
     * Calculo el porcentaje contra el total cuando las partes suman ese
     * total (formas de pago y motivos de merma) y contra el valor más
     * alto cuando se trata de un ranking, para que el primer lugar
     * siempre llene la barra completa.
     *
     * Uso useMemo para que las agrupaciones solo se rehagan cuando
     * cambian las ventas, las mermas, los productos o los filtros.
     */
    const reports = useMemo(() => {
        // Sumo el importe y las ventas de cada forma de pago.
        const paymentBreakdown = PAYMENT_METHODS.map((method) => {
            const methodSales = filteredSales.filter(
                (sale) => sale.paymentMethod === method,
            );

            return {
                method,
                count: methodSales.length,
                total: roundCurrency(
                    methodSales.reduce((sum, sale) => sum + sale.total, 0),
                ),
            };
        });

        const paymentTotal = roundCurrency(
            paymentBreakdown.reduce((sum, row) => sum + row.total, 0),
        );

        /*
         * Agrupo los artículos vendidos por nombre para saber cuáles
         * salieron más.
         *
         * Uso un Map como acumulador porque necesito sumar dos datos
         * distintos del mismo artículo: las unidades y el importe.
         *
         * Busco el producto por nombre para reutilizar su icono, ya que
         * la venta guarda el nombre del artículo y no su identificador.
         */
        const productTotals = new Map<
            string,
            { units: number; total: number; icon: string }
        >();

        filteredSales.forEach((sale) => {
            sale.items.forEach((item) => {
                const previous = productTotals.get(item.name);

                productTotals.set(item.name, {
                    units: (previous?.units ?? 0) + item.qty,
                    total: (previous?.total ?? 0) + item.subtotal,
                    icon:
                        previous?.icon ??
                        products.find(
                            (product) => product.name === item.name,
                        )?.icon ??
                        "inventory_2",
                });
            });
        });

        // Ordeno de mayor a menor por unidades y limito el ranking.
        const topProducts = [...productTotals.entries()]
            .map(([name, totals]) => ({
                name,
                units: totals.units,
                total: roundCurrency(totals.total),
                icon: totals.icon,
            }))
            .sort((a, b) => b.units - a.units || b.total - a.total)
            .slice(0, MAX_TOP_PRODUCTS);

        const topProductUnits = topProducts.reduce(
            (max, row) => Math.max(max, row.units),
            0,
        );


        // Agrupo las mermas por motivo para saber en qué se pierde más.
        const wasteByReason = WASTE_REASONS.map((reason) => {
            const reasonRecords = filteredWasteRecords.filter(
                (record) => record.reason === reason,
            );

            return {
                reason,
                units: reasonRecords.reduce(
                    (sum, record) => sum + record.quantity,
                    0,
                ),
                loss: roundCurrency(
                    reasonRecords.reduce(
                        (sum, record) =>
                            sum +
                            getWasteUnitCost(record, products) *
                                record.quantity,
                        0,
                    ),
                ),
            };
        })
            .filter((row) => row.units > 0)
            .sort((a, b) => b.loss - a.loss);

        const wasteLoss = roundCurrency(
            wasteByReason.reduce((sum, row) => sum + row.loss, 0),
        );

        /*
         * Agrupo las mermas por producto para saber qué mercancía se
         * pierde más.
         *
         * Conservo el nombre que tenía el producto aunque ya no exista
         * para que la pérdida siga siendo identificable.
         */
        const wasteProductTotals = new Map<
            number,
            { name: string; units: number; loss: number }
        >();

        filteredWasteRecords.forEach((record) => {
            const previous = wasteProductTotals.get(record.productId);

            wasteProductTotals.set(record.productId, {
                name:
                    previous?.name ??
                    products.find(
                        (product) => product.id === record.productId,
                    )?.name ??
                    "Producto no disponible",
                units: (previous?.units ?? 0) + record.quantity,
                loss:
                    (previous?.loss ?? 0) +
                    getWasteUnitCost(record, products) * record.quantity,
            });
        });

        // Ordeno de mayor a menor pérdida y limito el ranking.
        const wasteByProduct = [...wasteProductTotals.values()]
            .map((row) => ({
                name: row.name,
                units: row.units,
                loss: roundCurrency(row.loss),
            }))
            .sort((a, b) => b.loss - a.loss)
            .slice(0, MAX_TOP_PRODUCTS);

        const wasteProductLoss = wasteByProduct.reduce(
            (max, row) => Math.max(max, row.loss),
            0,
        );

        return {
            paymentBreakdown,
            paymentTotal,
            topProducts,
            topProductUnits,
            wasteByReason,
            wasteLoss,
            wasteByProduct,
            wasteProductLoss,
        };
    }, [filteredSales, filteredWasteRecords, products]);

    /*
     * Separo los dos casos que pueden dejar la pantalla sin datos:
     *
     * 1. Todavía no existe ninguna venta ni merma en la sesión.
     * 2. Ya existen registros, pero los filtros no alcanzan a ninguno.
     *
     * Así puedo explicar cada caso con su propio mensaje en lugar de
     * mostrar un resumen lleno de ceros.
     */
    const hasAnyData = sales.length > 0 || wasteRecords.length > 0;

    const hasData =
        summary.salesCount > 0 || filteredWasteRecords.length > 0;

  return (
    <section className="flex h-full flex-col overflow-hidden bg-[#F0F2F7]">
      {/* Encabezado del módulo. */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-7 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0E6] text-[#FF5C00]">
            <MaterialIcon
              name="bar_chart"
              className="text-2xl"
              filled
            />
          </div>

          <div>
            <h1 className="text-xl font-bold text-[#0D0F14]">
              Reportes
            </h1>

            <p className="text-sm text-[#6B7280]">
              Resumen de las ventas y las mermas registradas en la sesión.
            </p>
          </div>
        </div>

        {/* Aclaro de dónde proviene la información del reporte. */}
        <span className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-xs font-semibold text-[#6B7280]">
          Datos de la sesión actual
        </span>
      </header>

      <div className="flex-1 overflow-y-auto p-7">
        {/* Presento los indicadores principales del periodo. */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            title="Ventas registradas"
            value={formatUnits(summary.salesCount)}
            icon="receipt_long"
            iconClassName="bg-[#EDE9FE] text-[#6D28D9]"
          />

          <SummaryCard
            title="Importe vendido"
            value={formatCurrency(summary.totalSales)}
            icon="point_of_sale"
            iconClassName="bg-[#FFF0E6] text-[#FF5C00]"
          />

          <SummaryCard
            title="Ticket promedio"
            value={formatCurrency(summary.averageTicket)}
            icon="equalizer"
            iconClassName="bg-[#DCFCE7] text-[#166534]"
          />

          <SummaryCard
            title="Unidades vendidas"
            value={formatUnits(summary.totalUnits)}
            icon="shopping_bag"
            iconClassName="bg-[#DBEAFE] text-[#1D4ED8]"
          />

          <SummaryCard
            title="Pérdida por mermas"
            value={formatCurrency(summary.estimatedLoss)}
            icon="trending_down"
            iconClassName="bg-[#FEE2E2] text-[#B91C1C]"
          />
        </div>

        {/* Permito acotar el periodo y la forma de pago consultada. */}
        <div className="mb-6 rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#EDE9FE] text-[#6D28D9]">
                <MaterialIcon
                  name="filter_list"
                  className="text-xl"
                  filled
                />
              </div>

              <div>
                <h2 className="font-bold text-[#0D0F14]">
                  Filtros del reporte
                </h2>

                <p className="text-xs text-[#9CA3AF]">
                  Acota el periodo y la forma de pago que quieres consultar.
                </p>
              </div>
            </div>

            {hasFiltersApplied && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex flex-shrink-0 items-center gap-2 rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs font-semibold text-[#6B7280] hover:border-[#FF5C00] hover:text-[#FF5C00]"
              >
                <MaterialIcon
                  name="filter_list_off"
                  className="text-base"
                />

                Limpiar filtros
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-[#6B7280]">
                Desde
              </span>

              <input
                type="date"
                value={fromDate}
                max={toDate === "" ? undefined : toDate}
                onChange={(event) => setFromDate(event.target.value)}
                aria-label="Fecha inicial del reporte"
                className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#0D0F14] outline-none focus:border-[#FF5C00]"
              />
            </label>

            <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-[#6B7280]">
                Hasta
              </span>

              <input
                type="date"
                value={toDate}
                min={fromDate === "" ? undefined : fromDate}
                onChange={(event) => setToDate(event.target.value)}
                aria-label="Fecha final del reporte"
                className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#0D0F14] outline-none focus:border-[#FF5C00]"
              />
            </label>

            <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-[#6B7280]">
                Forma de pago
              </span>

              <select
                value={methodFilter}
                onChange={(event) =>
                  setMethodFilter(
                    event.target.value as
                      | "all"
                      | SaleRecord["paymentMethod"],
                  )
                }
                aria-label="Filtrar por forma de pago"
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#374151] outline-none focus:border-[#FF5C00]"
              >
                <option value="all">Todas las formas de pago</option>

                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {hasInvalidRange ? (
            /* Aviso cuando el rango de fechas está invertido. */
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-[#FEE2E2] px-3 py-2 text-xs font-semibold text-[#B91C1C]">
              <MaterialIcon name="error" className="text-base" filled />

              La fecha inicial es posterior a la final, así que no hay
              operaciones que mostrar.
            </p>
          ) : (
            /* Confirmo cuántas operaciones entraron al reporte. */
            <p className="mt-3 text-xs text-[#9CA3AF]">
              {formatCount(
                filteredSales.length,
                "venta considerada",
                "ventas consideradas",
              )}{" "}
              y{" "}
              {formatCount(
                filteredWasteRecords.length,
                "merma considerada",
                "mermas consideradas",
              )}{" "}
              en los reportes.
            </p>
          )}
        </div>

        {hasData ? (
          /* Cuando ya existen datos muestro el detalle de lo considerado. */
          <div className="mb-5 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
            <div className="flex items-center gap-3 border-b border-[#E5E7EB] px-5 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0E6] text-[#FF5C00]">
                <MaterialIcon
                  name="insights"
                  className="text-xl"
                  filled
                />
              </div>

              <div>
                <h2 className="font-bold text-[#0D0F14]">
                  Detalle del periodo
                </h2>

                <p className="text-xs text-[#9CA3AF]">
                  Información que se está considerando en el resumen.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-10 gap-y-1 p-5 lg:grid-cols-2">
              <ReportRow
                label="Ventas consideradas"
                value={formatCount(summary.salesCount, "venta", "ventas")}
              />

              <ReportRow
                label="Unidades vendidas"
                value={formatCount(summary.totalUnits, "unidad", "unidades")}
              />

              <ReportRow
                label="Mermas consideradas"
                value={formatCount(filteredWasteRecords.length, "merma", "mermas")}
              />

              <ReportRow
                label="Unidades perdidas"
                value={formatCount(summary.wasteUnits, "unidad", "unidades")}
              />

              <ReportRow
                label="Importe promedio por venta"
                value={formatCurrency(summary.averageTicket)}
              />

              <ReportRow
                label="Importe total vendido"
                value={formatCurrency(summary.totalSales)}
                emphasized
              />
            </div>
          </div>
        ) : !hasAnyData ? (
          /* Cuando todavía no hay datos explico de dónde saldrá la información. */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF5F0] text-[#FF5C00]">
              <MaterialIcon
                name="bar_chart"
                className="text-4xl"
                filled
              />
            </div>

            <h2 className="mb-2 text-lg font-bold text-[#0D0F14]">
              Todavía no hay información para el reporte
            </h2>

            <p className="max-w-md text-sm leading-6 text-[#6B7280]">
              Los indicadores se calcularán automáticamente cuando registres
              ventas en el Punto de Venta o mermas en el módulo de Mermas.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-xs font-semibold text-[#6B7280]">
                0 ventas registradas
              </span>

              <span className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-xs font-semibold text-[#6B7280]">
                0 mermas registradas
              </span>
            </div>
          </div>
        ) : (
          /* Cuando los filtros no alcanzan ningún registro lo aclaro. */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F3F4F6] text-[#9CA3AF]">
              <MaterialIcon
                name="filter_list_off"
                className="text-4xl"
                filled
              />
            </div>

            <h2 className="mb-2 text-lg font-bold text-[#0D0F14]">
              No hay operaciones en el periodo consultado
            </h2>

            <p className="max-w-md text-sm leading-6 text-[#6B7280]">
              Ya existen ventas o mermas registradas, pero ninguna cae dentro
              del rango de fechas o de la forma de pago seleccionada.
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 rounded-xl bg-[#FF5C00] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#E64F00]"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {hasData && (
          <>
          {/* Detallo las ventas que entraron al reporte. */}
          <ReportSection
            title="Ventas del periodo"
            description="Operaciones consideradas después de aplicar los filtros."
            icon="receipt_long"
            iconClassName="bg-[#EDE9FE] text-[#6D28D9]"
          >
            {filteredSales.length === 0 ? (
              <EmptySection
                icon="receipt_long"
                message="No hay ventas registradas con los filtros seleccionados."
              />
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="bg-[#F9FAFB]">
                      {[
                        "Folio",
                        "Fecha",
                        "Hora",
                        "Forma de pago",
                        "Unidades",
                        "Total",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className={`sticky top-0 bg-[#F9FAFB] px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#6B7280] ${
                            heading === "Unidades" || heading === "Total"
                              ? "text-right"
                              : "text-left"
                          }`}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {/* Muestro primero la venta más reciente del periodo. */}
                    {[...filteredSales].reverse().map((sale) => (
                      <tr
                        key={sale.folio}
                        className="border-t border-[#F3F4F6] hover:bg-[#FAFAFA]"
                      >
                        <td className="px-5 py-3">
                          <span className="rounded-md bg-[#F3F4F6] px-2 py-1 font-mono text-xs font-semibold text-[#6B7280]">
                            {sale.folio}
                          </span>
                        </td>

                        <td className="px-5 py-3 text-[#6B7280]">
                          {sale.date}
                        </td>

                        <td className="px-5 py-3 text-[#6B7280]">
                          {sale.time}
                        </td>

                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-2 font-semibold text-[#374151]">
                            <MaterialIcon
                              name={PAYMENT_METHOD_ICONS[sale.paymentMethod]}
                              className="text-lg text-[#FF5C00]"
                            />

                            {PAYMENT_METHOD_LABELS[sale.paymentMethod]}
                          </span>
                        </td>

                        <td className="px-5 py-3 text-right tabular-nums text-[#6B7280]">
                          {formatUnits(countSaleUnits(sale))}
                        </td>

                        <td className="px-5 py-3 text-right font-bold tabular-nums text-[#0D0F14]">
                          {formatCurrency(sale.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ReportSection>

          {/* Desgloso el importe cobrado por forma de pago. */}
          <ReportSection
            title="Formas de pago"
            description="Cómo se cobraron las ventas del periodo consultado."
            icon="payments"
            iconClassName="bg-[#DCFCE7] text-[#166534]"
          >
            {summary.salesCount === 0 ? (
              <EmptySection
                icon="payments"
                message="No hay importes cobrados con los filtros seleccionados."
              />
            ) : (
              reports.paymentBreakdown.map((row) => (
                <BarRow
                  key={row.method}
                  label={PAYMENT_METHOD_LABELS[row.method]}
                  detail={formatCount(row.count, "venta", "ventas")}
                  value={formatCurrency(row.total)}
                  percent={toPercent(row.total, reports.paymentTotal)}
                  barClassName={PAYMENT_METHOD_BAR_CLASSES[row.method]}
                  icon={PAYMENT_METHOD_ICONS[row.method]}
                />
              ))
            )}
          </ReportSection>

          {/* Ranking de los artículos más vendidos. */}
          <ReportSection
            title="Productos más vendidos"
            description="Los artículos con más unidades vendidas en el periodo."
            icon="local_fire_department"
            iconClassName="bg-[#FFF0E6] text-[#FF5C00]"
          >
            {reports.topProducts.length === 0 ? (
              <EmptySection
                icon="shopping_bag"
                message="No hay artículos vendidos con los filtros seleccionados."
              />
            ) : (
              reports.topProducts.map((row) => (
                <BarRow
                  key={row.name}
                  label={row.name}
                  detail={`${formatCount(row.units, "unidad vendida", "unidades vendidas")} · ${formatCurrency(row.total)}`}
                  value={formatUnits(row.units)}
                  percent={toPercent(row.units, reports.topProductUnits)}
                  barClassName="bg-[#FF5C00]"
                  icon={row.icon}
                  iconClassName="bg-[#FFF0E6] text-[#FF5C00]"
                />
              ))
            )}
          </ReportSection>

          {/* Ranking de las mermas agrupadas por motivo. */}
          <ReportSection
            title="Mermas por motivo"
            description="En qué se está perdiendo mercancía dentro del periodo."
            icon="delete_sweep"
            iconClassName="bg-[#FEE2E2] text-[#B91C1C]"
          >
            {reports.wasteByReason.length === 0 ? (
              <EmptySection
                icon="delete_sweep"
                message="No hay mermas registradas con los filtros seleccionados."
              />
            ) : (
              reports.wasteByReason.map((row) => (
                <BarRow
                  key={row.reason}
                  label={WASTE_REASON_LABELS[row.reason]}
                  detail={`${formatCount(row.units, "unidad perdida", "unidades perdidas")} · ${formatCurrency(row.loss)} de pérdida`}
                  value={formatCurrency(row.loss)}
                  percent={toPercent(row.loss, reports.wasteLoss)}
                  barClassName={WASTE_REASON_BAR_CLASSES[row.reason]}
                  icon={WASTE_REASON_ICONS[row.reason]}
                  iconClassName={WASTE_REASON_ICON_CLASSES[row.reason]}
                />
              ))
            )}
          </ReportSection>

          {/* Ranking de los productos que más pérdida generaron. */}
          <ReportSection
            title="Productos con más mermas"
            description="Los artículos que más pérdida generaron en el periodo."
            icon="report"
            iconClassName="bg-[#FFEDD5] text-[#C2410C]"
          >
            {reports.wasteByProduct.length === 0 ? (
              <EmptySection
                icon="report"
                message="No hay pérdidas registradas con los filtros seleccionados."
              />
            ) : (
              reports.wasteByProduct.map((row) => (
                <BarRow
                  key={row.name}
                  label={row.name}
                  detail={`${formatCount(row.units, "unidad perdida", "unidades perdidas")} · ${toPercent(row.loss, reports.wasteLoss)}% de la pérdida total`}
                  value={formatCurrency(row.loss)}
                  percent={toPercent(row.loss, reports.wasteProductLoss)}
                  barClassName="bg-[#F97316]"
                  icon="inventory_2"
                  iconClassName="bg-[#FFEDD5] text-[#C2410C]"
                />
              ))
            )}
          </ReportSection>
          </>
        )}

        {/* Aclaro qué funciones quedan pendientes para el reporte final. */}
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#FED7C3] bg-[#FFF7F2] p-4">
          <MaterialIcon
            name="info"
            className="mt-0.5 text-xl text-[#FF5C00]"
            filled
          />

          <div>
            <p className="text-sm font-bold text-[#5A3825]">
              Alcance actual del reporte
            </p>

            <p className="mt-0.5 text-xs leading-5 text-[#9A6B50]">
              El reporte calcula los indicadores del periodo con las ventas y
              las mermas de la sesión, permite filtrar por rango de fechas y
              por forma de pago, y muestra el detalle de las ventas, el
              desglose por forma de pago, los productos más vendidos y las
              mermas por motivo y por producto. Queda pendiente guardar la
              información en la base de datos para consultar periodos
              anteriores.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
