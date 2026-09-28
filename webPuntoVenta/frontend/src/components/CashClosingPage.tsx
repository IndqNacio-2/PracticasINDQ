import { useMemo, useState } from "react";

import type { CashClosingRecord, SaleRecord } from "../types";
import MaterialIcon from "./MaterialIcon";

/*
 * Defino los datos que el módulo de Corte de caja
 * recibirá desde el componente principal.
 */
interface CashClosingPageProps {
  // Recibo las ventas realizadas durante el turno vigente.
  sales: SaleRecord[];

  // Recibo los cortes registrados para mostrarlos en el historial.
  closings: CashClosingRecord[];

  // Recibo el fondo inicial capturado para el turno actual.
  initialFund: number;

  // Recibo el efectivo contado capturado para el turno actual.
  countedCash: number;

  // Notifico al estado principal cuando cambia el fondo inicial.
  onInitialFundChange: (value: number) => void;

  // Notifico al estado principal cuando cambia el efectivo contado.
  onCountedCashChange: (value: number) => void;

  // Entrego el corte terminado para guardarlo en el historial.
  onConfirmClosing: (closing: CashClosingRecord) => void;
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

/*
 * Redondeo los importes a dos decimales para evitar
 * pequeños errores de precisión al sumar dinero.
 */
const roundCurrency = (value: number): number =>
  Math.round(value * 100) / 100;

/*
 * Convierto el texto que escribe el usuario en un monto válido.
 *
 * Cuando el campo está vacío o contiene un valor inválido
 * devuelvo cero para no romper los cálculos del arqueo.
 */
const parseAmount = (value: string): number => {
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/*
 * Muestro la diferencia con su signo para identificar rápidamente
 * si la caja quedó con sobrante o con faltante.
 */
const formatDifference = (difference: number): string => {
  /*
   * Cuando el conteo coincide solamente muestro el importe en cero
   * para no confundirlo con un movimiento de efectivo.
   */
  if (difference === 0) {
    return formatCurrency(0);
  }

  const sign = difference > 0 ? "+" : "-";

  return `${sign}${formatCurrency(Math.abs(difference))}`;
};

/*
 * Defino el mensaje y los colores que corresponden
 * según el resultado del arqueo de caja.
 */
const getDifferenceStatus = (difference: number) => {
  /*
   * Cuando el efectivo contado coincide con el esperado
   * considero que la caja quedó exacta.
   */
  if (difference === 0) {
    return {
      label: "Caja exacta",
      message: "El efectivo contado coincide con el efectivo esperado.",
      icon: "check_circle",
      containerClassName: "bg-[#DCFCE7] text-[#166534]",
      amountClassName: "text-[#166534]",
    };
  }

  /*
   * Cuando se contó más dinero del esperado
   * existe un sobrante en la caja.
   */
  if (difference > 0) {
    return {
      label: "Sobrante",
      message: "Se contó más efectivo del que se esperaba en la caja.",
      icon: "trending_up",
      containerClassName: "bg-[#DBEAFE] text-[#1D4ED8]",
      amountClassName: "text-[#1D4ED8]",
    };
  }

  /*
   * Cuando se contó menos dinero del esperado
   * existe un faltante en la caja.
   */
  return {
    label: "Faltante",
    message: "Se contó menos efectivo del que se esperaba en la caja.",
    icon: "trending_down",
    containerClassName: "bg-[#FEE2E2] text-[#B91C1C]",
    amountClassName: "text-[#B91C1C]",
  };
};

export default function CashClosingPage({
  sales,
  closings,
  initialFund,
  countedCash,
  onInitialFundChange,
  onCountedCashChange,
  onConfirmClosing,
}: CashClosingPageProps) {
  /*
   * Conservo el texto exacto que el usuario escribe en los campos
   * para que pueda borrar los dígitos sin que el cero
   * vuelva a aparecer automáticamente.
   */
  const [initialFundText, setInitialFundText] = useState(
    initialFund === 0 ? "" : String(initialFund),
  );
  const [countedCashText, setCountedCashText] = useState(
    countedCash === 0 ? "" : String(countedCash),
  );

  // Controlo la ventana que confirma el corte de caja.
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  /*
   * Calculo el total general, los importes de cada método de pago
   * y el resultado del arqueo solamente cuando cambian
   * el historial de ventas o los montos capturados.
   */
  const summary = useMemo(() => {
    const totalSales = sales.reduce(
      (total, sale) => total + sale.total,
      0,
    );

    const cashSales = sales
      .filter((sale) => sale.paymentMethod === "efectivo")
      .reduce((total, sale) => total + sale.total, 0);

    const cardSales = sales
      .filter((sale) => sale.paymentMethod === "tarjeta")
      .reduce((total, sale) => total + sale.total, 0);

    const transferSales = sales
      .filter((sale) => sale.paymentMethod === "transferencia")
      .reduce((total, sale) => total + sale.total, 0);

    /*
     * Calculo el efectivo que debería existir en la caja
     * sumando el fondo inicial con las ventas cobradas en efectivo.
     */
    const expectedCash = roundCurrency(initialFund + cashSales);

    /*
     * Comparo el efectivo contado con el esperado para saber
     * si la caja quedó exacta, con sobrante o con faltante.
     */
    const difference = roundCurrency(countedCash - expectedCash);

    return {
      totalSales: roundCurrency(totalSales),
      cashSales: roundCurrency(cashSales),
      cardSales: roundCurrency(cardSales),
      transferSales: roundCurrency(transferSales),
      expectedCash,
      difference,
    };
  }, [sales, initialFund, countedCash]);

  // Obtengo el mensaje y los colores que corresponden al arqueo.
  const differenceStatus = getDifferenceStatus(summary.difference);

  /*
   * Evito registrar un corte cuando el turno todavía no tiene
   * ventas ni fondo inicial capturado.
   */
  const canCloseShift = sales.length > 0 || initialFund > 0;

  // Actualizo el fondo inicial mientras el usuario escribe.
  const handleInitialFundChange = (value: string) => {
    setInitialFundText(value);
    onInitialFundChange(parseAmount(value));
  };

  // Actualizo el efectivo contado mientras el usuario escribe.
  const handleCountedCashChange = (value: string) => {
    setCountedCashText(value);
    onCountedCashChange(parseAmount(value));
  };

  /*
   * Construyo el corte con la información del turno
   * y lo entrego al estado principal para guardarlo.
   */
  const handleConfirmClosing = () => {
    const now = new Date();

    const closing: CashClosingRecord = {
      /*
       * Genero el folio a partir de los cortes ya registrados
       * mientras el historial se conserva en memoria.
       */
      folio: `CC-${String(closings.length + 1).padStart(4, "0")}`,
      date: now.toLocaleDateString("es-MX"),
      time: now.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      salesCount: sales.length,
      totalSales: summary.totalSales,
      cashSales: summary.cashSales,
      cardSales: summary.cardSales,
      transferSales: summary.transferSales,
      initialFund,
      expectedCash: summary.expectedCash,
      countedCash,
      difference: summary.difference,
      registeredBy: "Edgar Rodríguez",
    };

    onConfirmClosing(closing);

    /*
     * Limpio los campos del arqueo porque el turno
     * vuelve a comenzar después del corte.
     */
    setInitialFundText("");
    setCountedCashText("");
    setIsConfirmOpen(false);
  };

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
              Resumen de las ventas, el arqueo y los cortes del turno.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Recuerdo el último folio cerrado para dar seguimiento al turno. */}
          {closings.length > 0 && (
            <span className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-xs font-semibold text-[#6B7280]">
              Último corte: CC-
              {String(closings.length).padStart(4, "0")}
            </span>
          )}

          <span className="rounded-full bg-[#DCFCE7] px-3 py-1.5 text-xs font-bold text-[#166534]">
            Turno abierto
          </span>
        </div>
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
            value={formatCurrency(summary.totalSales)}
            icon="point_of_sale"
            iconClassName="bg-[#FFF0E6] text-[#FF5C00]"
          />

          <SummaryCard
            title="Efectivo"
            value={formatCurrency(summary.cashSales)}
            icon="payments"
            iconClassName="bg-[#DCFCE7] text-[#166534]"
          />

          <SummaryCard
            title="Tarjeta"
            value={formatCurrency(summary.cardSales)}
            icon="credit_card"
            iconClassName="bg-[#DBEAFE] text-[#1D4ED8]"
          />

          <SummaryCard
            title="Transferencia"
            value={formatCurrency(summary.transferSales)}
            icon="account_balance"
            iconClassName="bg-[#FEF3C7] text-[#92400E]"
          />
        </div>

        {/* Capturo el fondo inicial y el efectivo contado del turno. */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          <div className="flex items-center gap-3 border-b border-[#E5E7EB] px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0E6] text-[#FF5C00]">
              <MaterialIcon
                name="calculate"
                className="text-xl"
                filled
              />
            </div>

            <div>
              <h2 className="font-bold text-[#0D0F14]">
                Arqueo de caja
              </h2>

              <p className="text-xs text-[#9CA3AF]">
                Captura el fondo inicial y el efectivo contado para conocer la diferencia.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
            {/* Campos que captura el usuario durante el turno. */}
            <div>
              <label className="mb-4 block">
                <span className="mb-1.5 block text-sm font-semibold text-[#374151]">
                  Fondo inicial de caja
                </span>

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-[#9CA3AF]">
                    $
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={initialFundText}
                    onChange={(event) =>
                      handleInitialFundChange(event.target.value)
                    }
                    placeholder="0.00"
                    className="w-full rounded-xl border-2 border-[#E5E7EB] py-3 pl-9 pr-4 text-lg font-bold text-[#0D0F14] outline-none focus:border-[#FF5C00]"
                  />
                </div>

                <span className="mt-1.5 block text-xs text-[#9CA3AF]">
                  Dinero con el que inició el turno.
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[#374151]">
                  Efectivo contado
                </span>

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-[#9CA3AF]">
                    $
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={countedCashText}
                    onChange={(event) =>
                      handleCountedCashChange(event.target.value)
                    }
                    placeholder="0.00"
                    className="w-full rounded-xl border-2 border-[#E5E7EB] py-3 pl-9 pr-4 text-lg font-bold text-[#0D0F14] outline-none focus:border-[#FF5C00]"
                  />
                </div>

                <span className="mt-1.5 block text-xs text-[#9CA3AF]">
                  Dinero que se contó físicamente al final del turno.
                </span>
              </label>
            </div>

            {/* Resultado del arqueo con el desglose del efectivo. */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <ArqueoRow
                label="Fondo inicial"
                value={formatCurrency(initialFund)}
              />

              <ArqueoRow
                label="Ventas en efectivo"
                value={formatCurrency(summary.cashSales)}
              />

              <ArqueoRow
                label="Efectivo esperado"
                value={formatCurrency(summary.expectedCash)}
                hint="Fondo inicial más ventas en efectivo"
                emphasized
              />

              <ArqueoRow
                label="Efectivo contado"
                value={formatCurrency(countedCash)}
                emphasized
              />

              <div
                className={`mt-3 flex items-start gap-3 rounded-xl p-3.5 ${differenceStatus.containerClassName}`}
              >
                <MaterialIcon
                  name={differenceStatus.icon}
                  className="mt-0.5 text-xl"
                  filled
                />

                <div>
                  <p className="text-sm font-bold">
                    {differenceStatus.label}:{" "}
                    {formatDifference(summary.difference)}
                  </p>

                  <p className="mt-0.5 text-xs leading-5 opacity-80">
                    {differenceStatus.message}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsConfirmOpen(true)}
                disabled={!canCloseShift}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF5C00] px-5 py-3.5 font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <MaterialIcon
                  name="lock_clock"
                  className="text-xl"
                  filled
                />

                Realizar corte
              </button>

              {!canCloseShift && (
                <p className="mt-2 text-center text-xs text-[#9CA3AF]">
                  Registra el fondo inicial o realiza una venta para poder cerrar el turno.
                </p>
              )}
            </div>
          </div>
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

        {/* Muestro los cortes de caja realizados durante la sesión. */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
            <div>
              <h2 className="font-bold text-[#0D0F14]">
                Historial de cortes
              </h2>

              <p className="text-xs text-[#9CA3AF]">
                Cada corte guarda el fondo, el efectivo esperado y la diferencia del turno.
              </p>
            </div>

            <span className="text-xs font-semibold text-[#6B7280]">
              {closings.length} corte
              {closings.length === 1 ? "" : "s"}
            </span>
          </div>

          {closings.length === 0 ? (
            /* Muestro un estado vacío cuando todavía no existen cortes. */
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F3F4F6] text-[#9CA3AF]">
                <MaterialIcon
                  name="history"
                  className="text-3xl"
                />
              </div>

              <p className="font-semibold text-[#374151]">
                No hay cortes registrados
              </p>

              <p className="mt-1 max-w-sm text-sm text-[#9CA3AF]">
                Al realizar el corte del turno aparecerá aquí el resumen
                con el fondo inicial, el efectivo contado y la diferencia.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB]">
                    {[
                      "Folio",
                      "Fecha",
                      "Hora",
                      "Ventas",
                      "Total",
                      "Fondo",
                      "Esperado",
                      "Contado",
                      "Diferencia",
                    ].map((heading) => {
                      /*
                       * Alineo a la derecha las columnas numéricas
                       * para comparar los importes con facilidad.
                       */
                      const isNumeric = [
                        "Ventas",
                        "Total",
                        "Fondo",
                        "Esperado",
                        "Contado",
                        "Diferencia",
                      ].includes(heading);

                      return (
                        <th
                          key={heading}
                          className={`px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#6B7280] ${
                            isNumeric ? "text-right" : "text-left"
                          }`}
                        >
                          {heading}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {/* Ordeno una copia para mostrar primero el corte más reciente. */}
                  {[...closings].reverse().map((closing) => {
                    // Obtengo los colores según la diferencia del corte.
                    const closingStatus = getDifferenceStatus(
                      closing.difference,
                    );

                    return (
                      <tr
                        key={closing.folio}
                        className="border-t border-[#F3F4F6] hover:bg-[#FAFAFA]"
                      >
                        <td className="px-5 py-3">
                          <span className="rounded-md bg-[#F3F4F6] px-2 py-1 font-mono text-xs font-semibold text-[#6B7280]">
                            {closing.folio}
                          </span>
                        </td>

                        <td className="px-5 py-3 text-[#6B7280]">
                          {closing.date}
                        </td>

                        <td className="px-5 py-3 text-[#6B7280]">
                          {closing.time}
                        </td>

                        <td className="px-5 py-3 text-right text-[#6B7280]">
                          {closing.salesCount}
                        </td>

                        <td className="px-5 py-3 text-right font-semibold text-[#374151]">
                          {formatCurrency(closing.totalSales)}
                        </td>

                        <td className="px-5 py-3 text-right text-[#6B7280]">
                          {formatCurrency(closing.initialFund)}
                        </td>

                        <td className="px-5 py-3 text-right text-[#6B7280]">
                          {formatCurrency(closing.expectedCash)}
                        </td>

                        <td className="px-5 py-3 text-right text-[#6B7280]">
                          {formatCurrency(closing.countedCash)}
                        </td>

                        <td
                          className={`px-5 py-3 text-right font-bold ${closingStatus.amountClassName}`}
                        >
                          {formatDifference(closing.difference)}
                        </td>
                      </tr>
                    );
                  })}
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
              Alcance actual del corte
            </p>

            <p className="mt-0.5 text-xs leading-5 text-[#9A6B50]">
              El corte ya calcula el fondo inicial, el efectivo esperado,
              el efectivo contado y la diferencia. Queda pendiente imprimir
              el comprobante y guardar los cortes en la base de datos.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmo el cierre antes de registrar el corte del turno. */}
      {isConfirmOpen && (
        <ConfirmCashClosingModal
          salesCount={sales.length}
          totalSales={summary.totalSales}
          expectedCash={summary.expectedCash}
          countedCash={countedCash}
          difference={summary.difference}
          onConfirm={handleConfirmClosing}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
    </section>
  );
}

/*
 * Reutilizo esta fila para mostrar cada importe del arqueo
 * sin repetir la misma estructura.
 */
function ArqueoRow({
  label,
  value,
  hint,
  emphasized = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 py-2 ${
        emphasized ? "border-t border-[#E5E7EB]" : ""
      }`}
    >
      <div>
        <p
          className={`text-sm ${
            emphasized
              ? "font-bold text-[#0D0F14]"
              : "text-[#6B7280]"
          }`}
        >
          {label}
        </p>

        {hint && (
          <p className="mt-0.5 text-xs text-[#9CA3AF]">
            {hint}
          </p>
        )}
      </div>

      <p
        className={`flex-shrink-0 ${
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
 * Confirmo el corte antes de cerrar el turno para evitar
 * que se registre por accidente.
 */
function ConfirmCashClosingModal({
  salesCount,
  totalSales,
  expectedCash,
  countedCash,
  difference,
  onConfirm,
  onCancel,
}: {
  salesCount: number;
  totalSales: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Obtengo el mensaje y los colores según la diferencia capturada.
  const status = getDifferenceStatus(difference);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="modal-enter w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF5F0]">
            <MaterialIcon
              name="lock_clock"
              className="text-3xl text-[#FF5C00]"
              filled
            />
          </div>

          <h2 className="mb-2 text-lg font-bold text-[#0D0F14]">
            ¿Realizar el corte de caja?
          </h2>

          <p className="text-sm leading-6 text-[#6B7280]">
            Se cerrará el turno con {salesCount} venta
            {salesCount === 1 ? "" : "s"} registrada
            {salesCount === 1 ? "" : "s"} y comenzará un turno nuevo.
          </p>
        </div>

        {/* Repaso el resultado del arqueo antes de confirmar. */}
        <div className="mb-5 space-y-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-[#6B7280]">Total vendido</span>
            <strong className="text-[#0D0F14]">
              {formatCurrency(totalSales)}
            </strong>
          </div>

          <div className="flex justify-between">
            <span className="text-[#6B7280]">Efectivo esperado</span>
            <strong className="text-[#0D0F14]">
              {formatCurrency(expectedCash)}
            </strong>
          </div>

          <div className="flex justify-between">
            <span className="text-[#6B7280]">Efectivo contado</span>
            <strong className="text-[#0D0F14]">
              {formatCurrency(countedCash)}
            </strong>
          </div>

          <div className="flex justify-between border-t border-[#E5E7EB] pt-2">
            <span className="text-[#6B7280]">
              {status.label}
            </span>

            <strong className={status.amountClassName}>
              {formatDifference(difference)}
            </strong>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] py-3 font-semibold text-[#374151] hover:bg-[#F3F4F6]"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-xl bg-[#FF5C00] py-3 font-bold text-white hover:opacity-90"
          >
            Confirmar corte
          </button>
        </div>
      </div>
    </div>
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