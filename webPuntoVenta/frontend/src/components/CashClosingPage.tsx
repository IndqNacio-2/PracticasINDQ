import { useMemo } from "react";

import type { SaleRecord } from "../types";
import MaterialIcon from "./MaterialIcon";

/*
 * Defino los datos que el módulo de Corte de caja
 * recibirá desde el componente principal.
 */
interface CashClosingPageProps {
  // Recibo las ventas realizadas durante la sesión actual.
  sales: SaleRecord[];
}

/*
 * Relaciono cada método de pago con el nombre
 * que quiero mostrarle al usuario.
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
 * Relaciono cada método de pago con un icono
 * para identificarlo fácilmente en la tabla.
 */
const PAYMENT_METHOD_ICONS: Record<
  SaleRecord["paymentMethod"],
  string
> = {
  efectivo: "payments",
  tarjeta: "credit_card",
  transferencia: "account_balance",
};

// Formateo los valores como moneda mexicana.
const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);

export default function CashClosingPage({
  sales,
}: CashClosingPageProps) {
  /*
   * Calculo el total general y los importes de cada método
   * de pago solamente cuando cambia el historial de ventas.
   */
  const totals = useMemo(() => {
    const totalSales = sales.reduce(
      (total, sale) => total + sale.total,
      0,
    );

    const cashTotal = sales
      .filter((sale) => sale.paymentMethod === "efectivo")
      .reduce((total, sale) => total + sale.total, 0);

    const cardTotal = sales
      .filter((sale) => sale.paymentMethod === "tarjeta")
      .reduce((total, sale) => total + sale.total, 0);

    const transferTotal = sales
      .filter((sale) => sale.paymentMethod === "transferencia")
      .reduce((total, sale) => total + sale.total, 0);

    return {
      totalSales,
      cashTotal,
      cardTotal,
      transferTotal,
    };
  }, [sales]);

  return (
    <section className="flex h-full flex-col overflow-hidden bg-[#F0F2F7]">
      {/* Muestro el título y el estado temporal del turno. */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-7 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0E6] text-[#FF5C00]">
            <MaterialIcon
              name="payments"
              className="text-2xl"
              filled
            />
          </div>

          <div>
            <h1 className="text-xl font-bold text-[#0D0F14]">
              Corte de caja
            </h1>

            <p className="text-sm text-[#6B7280]">
              Resumen de las ventas realizadas durante el turno.
            </p>
          </div>
        </div>

        <span className="rounded-full bg-[#DCFCE7] px-3 py-1.5 text-xs font-bold text-[#166534]">
          Turno abierto
        </span>
      </header>

      <div className="flex-1 overflow-y-auto p-7">
        {/* Presento los principales totales de la caja. */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            title="Ventas realizadas"
            value={sales.length.toString()}
            icon="receipt_long"
            iconClassName="bg-[#EDE9FE] text-[#6D28D9]"
          />

          <SummaryCard
            title="Venta total"
            value={formatCurrency(totals.totalSales)}
            icon="point_of_sale"
            iconClassName="bg-[#FFF0E6] text-[#FF5C00]"
          />

          <SummaryCard
            title="Efectivo"
            value={formatCurrency(totals.cashTotal)}
            icon="payments"
            iconClassName="bg-[#DCFCE7] text-[#166534]"
          />

          <SummaryCard
            title="Tarjeta"
            value={formatCurrency(totals.cardTotal)}
            icon="credit_card"
            iconClassName="bg-[#DBEAFE] text-[#1D4ED8]"
          />

          <SummaryCard
            title="Transferencia"
            value={formatCurrency(totals.transferTotal)}
            icon="account_balance"
            iconClassName="bg-[#FEF3C7] text-[#92400E]"
          />
        </div>

        {/* Muestro las ventas que forman parte del turno actual. */}
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
            <div>
              <h2 className="font-bold text-[#0D0F14]">
                Ventas del turno
              </h2>

              <p className="text-xs text-[#9CA3AF]">
                Las ventas se conservan mientras la aplicación permanece abierta.
              </p>
            </div>

            <span className="text-xs font-semibold text-[#6B7280]">
              {sales.length} registro
              {sales.length === 1 ? "" : "s"}
            </span>
          </div>

          {sales.length === 0 ? (
            /* Muestro un estado vacío cuando todavía no existen ventas. */
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F3F4F6] text-[#9CA3AF]">
                <MaterialIcon
                  name="receipt_long"
                  className="text-3xl"
                />
              </div>

              <p className="font-semibold text-[#374151]">
                No hay ventas registradas
              </p>

              <p className="mt-1 max-w-sm text-sm text-[#9CA3AF]">
                Las ventas terminadas en el Punto de Venta aparecerán
                automáticamente en esta sección.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB]">
                    {[
                      "Folio",
                      "Fecha",
                      "Hora",
                      "Método",
                      "Total",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className={`px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#6B7280] ${
                          heading === "Total" ? "text-right" : "text-left"
                        }`}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {/* Ordeno una copia para mostrar primero la venta más reciente. */}
                  {[...sales].reverse().map((sale) => (
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

                      <td className="px-5 py-3 text-right font-bold text-[#0D0F14]">
                        {formatCurrency(sale.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Aclaro qué funciones quedan pendientes para el cierre real. */}
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#FED7C3] bg-[#FFF7F2] p-4">
          <MaterialIcon
            name="info"
            className="mt-0.5 text-xl text-[#FF5C00]"
            filled
          />

          <div>
            <p className="text-sm font-bold text-[#5A3825]">
              Primera versión del corte
            </p>

            <p className="mt-0.5 text-xs leading-5 text-[#9A6B50]">
              Queda pendiente agregar el fondo inicial, el efectivo contado
              y el cálculo de la diferencia.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/*
 * Reutilizo esta tarjeta para mostrar cada indicador
 * del resumen sin repetir la misma estructura.
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

      <p className="truncate text-xl font-bold text-[#0D0F14]">
        {value}
      </p>

      <p className="mt-1 text-xs font-medium text-[#6B7280]">
        {title}
      </p>
    </article>
  );
}