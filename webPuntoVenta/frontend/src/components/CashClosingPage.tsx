import { useEffect, useMemo, useState } from "react";

import type { CashClosingRecord, SaleRecord } from "../types";
import MaterialIcon from "./MaterialIcon";
import { getStoredUser } from '../auth/session';

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
      containerClassName: "bg-[var(--rx-success-bg)] text-[var(--rx-success-ink)]",
      amountClassName: "text-[var(--rx-success-ink)]",
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
      containerClassName: "bg-[var(--rx-warning-bg)] text-[var(--rx-warning-ink)]",
      amountClassName: "text-[var(--rx-warning-ink)]",
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
    containerClassName: "bg-[var(--rx-danger-bg)] text-[var(--rx-danger-ink)]",
    amountClassName: "text-[var(--rx-danger-ink)]",
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
  useEffect(() => {
    setInitialFundText(initialFund === 0 ? "" : String(initialFund));
  }, [initialFund]);
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
      registeredBy: getStoredUser()?.idUsuario ?? '',
    };

    onConfirmClosing(closing);

    // El padre limpia el fondo únicamente tras la confirmación del servidor.
    setIsConfirmOpen(false);
  };

  return (
    <section className="rx-closing">
      {/* Muestro el título y el estado temporal del turno. */}
      <header className="rx-page-header">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--rx-surface-soft)] text-[var(--rx-ink)]">
            <MaterialIcon
              name="payments"
              className="text-2xl"
              filled
            />
          </div>

          <div>
            <h1 className="rx-page-title">
              Corte de caja
            </h1>

            <p className="text-sm text-[var(--rx-ink-secondary)]">
              Resumen de las ventas, el arqueo y los cortes del turno.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Recuerdo el último folio cerrado para dar seguimiento al turno. */}
          {closings.length > 0 && (
            <span className="rx-badge">
              Último corte: {closings[closings.length - 1].folio}
            </span>
          )}

          <span className="rx-badge rx-badge--success">
            Turno abierto
          </span>
        </div>
      </header>

      <div className="rx-closing-content">
        {/* Presento los principales totales de la caja. */}
        <div className="rx-closing-kpis">
          <SummaryCard
            title="Ventas realizadas"
            value={sales.length.toString()}
            icon="receipt_long"
            iconClassName="bg-[var(--rx-surface-soft)] text-[var(--rx-ink-secondary)]"
          />

          <SummaryCard
            title="Venta total"
            value={formatCurrency(summary.totalSales)}
            icon="point_of_sale"
            iconClassName="bg-[var(--rx-surface-soft)] text-[var(--rx-ink)]"
          />

          <SummaryCard
            title="Efectivo"
            value={formatCurrency(summary.cashSales)}
            icon="payments"
            iconClassName="bg-[var(--rx-success-bg)] text-[var(--rx-success-ink)]"
          />

          <SummaryCard
            title="Tarjeta"
            value={formatCurrency(summary.cardSales)}
            icon="credit_card"
            iconClassName="bg-[var(--rx-surface-soft)] text-[var(--rx-ink-secondary)]"
          />

          <SummaryCard
            title="Transferencia"
            value={formatCurrency(summary.transferSales)}
            icon="account_balance"
            iconClassName="bg-[var(--rx-warning-bg)] text-[var(--rx-warning-ink)]"
          />
        </div>

        {/* Capturo el fondo inicial y el efectivo contado del turno. */}
        <div className="rx-card rx-closing-panel">
          <div className="rx-closing-panel-header">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--rx-surface-soft)] text-[var(--rx-ink)]">
              <MaterialIcon
                name="calculate"
                className="text-xl"
                filled
              />
            </div>

            <div>
              <h2 className="rx-card-title">
                Arqueo de caja
              </h2>

              <p className="text-xs text-[var(--rx-ink-secondary)]">
                Captura el fondo inicial y el efectivo contado para conocer la diferencia.
              </p>
            </div>
          </div>

          <div className="rx-closing-arqueo">
            {/* Campos que captura el usuario durante el turno. */}
            <div>
              <label className="mb-4 block">
                <span className="rx-label mb-1.5 block">
                  Fondo inicial de caja
                </span>

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-[var(--rx-ink-secondary)]">
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
                    className="rx-input rx-closing-amount"
                  />
                </div>

                <span className="mt-1.5 block text-xs text-[var(--rx-ink-secondary)]">
                  Dinero con el que inició el turno.
                </span>
              </label>

              <label className="block">
                <span className="rx-label mb-1.5 block">
                  Efectivo contado
                </span>

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-[var(--rx-ink-secondary)]">
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
                    className="rx-input rx-closing-amount"
                  />
                </div>

                <span className="mt-1.5 block text-xs text-[var(--rx-ink-secondary)]">
                  Dinero que se contó físicamente al final del turno.
                </span>
              </label>
            </div>

            {/* Resultado del arqueo con el desglose del efectivo. */}
            <div className="rx-closing-reconciliation">
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
                role="status" aria-live="polite" aria-atomic="true" className={`mt-3 flex items-start gap-3 rounded-xl p-3.5 ${differenceStatus.containerClassName}`}
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
                className="rx-btn rx-btn--dark rx-btn--block rx-closing-submit"
              >
                <MaterialIcon
                  name="lock_clock"
                  className="text-xl"
                  filled
                />

                Realizar corte
              </button>

              {!canCloseShift && (
                <p className="mt-2 text-center text-xs text-[var(--rx-ink-secondary)]">
                  Registra el fondo inicial o realiza una venta para poder cerrar el turno.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Muestro las ventas que forman parte del turno actual. */}
        <div className="rx-card rx-closing-panel">
          <div className="rx-closing-panel-header">
            <div>
              <h2 className="rx-card-title">
                Ventas del turno
              </h2>

              <p className="text-xs text-[var(--rx-ink-secondary)]">
                Tus ventas pendientes de incluir en un corte de caja.
              </p>
            </div>

            <span className="text-xs font-semibold text-[var(--rx-ink-secondary)]">
              {sales.length} registro
              {sales.length === 1 ? "" : "s"}
            </span>
          </div>

          {sales.length === 0 ? (
            /* Muestro un estado vacío cuando todavía no existen ventas. */
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--rx-surface-soft)] text-[var(--rx-ink-secondary)]">
                <MaterialIcon
                  name="receipt_long"
                  className="text-3xl"
                />
              </div>

              <p className="font-semibold text-[var(--rx-ink)]">
                No hay ventas registradas
              </p>

              <p className="mt-1 max-w-sm text-sm text-[var(--rx-ink-secondary)]">
                Las ventas terminadas en el Punto de Venta aparecerán
                automáticamente en esta sección.
              </p>
            </div>
          ) : (
            <div className="rx-table-wrap rx-closing-table-wrap" role="region" aria-label="Ventas del turno" tabIndex={0}>
              <table className="rx-table rx-closing-table">
                <thead>
                  <tr className="bg-[var(--rx-surface-soft)]">
                    {[
                      "Folio",
                      "Fecha",
                      "Hora",
                      "Método",
                      "Total",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className={`px-5 py-3 text-xs font-bold uppercase tracking-wide text-[var(--rx-ink-secondary)] ${
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
                      className="border-t border-[var(--rx-surface-soft)] hover:bg-[var(--rx-surface-soft)]"
                    >
                      <td className="px-5 py-3">
                        <span className="rounded-md bg-[var(--rx-surface-soft)] px-2 py-1 font-mono text-xs font-semibold text-[var(--rx-ink-secondary)]">
                          {sale.folio}
                        </span>
                      </td>

                      <td className="px-5 py-3 text-[var(--rx-ink-secondary)]">
                        {sale.date}
                      </td>

                      <td className="px-5 py-3 text-[var(--rx-ink-secondary)]">
                        {sale.time}
                      </td>

                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2 font-semibold text-[var(--rx-ink)]">
                          <MaterialIcon
                            name={PAYMENT_METHOD_ICONS[sale.paymentMethod]}
                            className="text-lg text-[var(--rx-ink)]"
                          />

                          {PAYMENT_METHOD_LABELS[sale.paymentMethod]}
                        </span>
                      </td>

                      <td className="px-5 py-3 text-right font-bold text-[var(--rx-ink)]">
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
        <div className="rx-card rx-closing-panel">
          <div className="rx-closing-panel-header">
            <div>
              <h2 className="rx-card-title">
                Historial de cortes
              </h2>

              <p className="text-xs text-[var(--rx-ink-secondary)]">
                Cada corte guarda el fondo, el efectivo esperado y la diferencia del turno.
              </p>
            </div>

            <span className="text-xs font-semibold text-[var(--rx-ink-secondary)]">
              {closings.length} corte
              {closings.length === 1 ? "" : "s"}
            </span>
          </div>

          {closings.length === 0 ? (
            /* Muestro un estado vacío cuando todavía no existen cortes. */
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--rx-surface-soft)] text-[var(--rx-ink-secondary)]">
                <MaterialIcon
                  name="history"
                  className="text-3xl"
                />
              </div>

              <p className="font-semibold text-[var(--rx-ink)]">
                No hay cortes registrados
              </p>

              <p className="mt-1 max-w-sm text-sm text-[var(--rx-ink-secondary)]">
                Al realizar el corte del turno aparecerá aquí el resumen
                con el fondo inicial, el efectivo contado y la diferencia.
              </p>
            </div>
          ) : (
            <div className="rx-table-wrap rx-closing-table-wrap" role="region" aria-label="Historial de cortes" tabIndex={0}>
              <table className="rx-table rx-closing-table rx-closing-table--history">
                <thead>
                  <tr className="bg-[var(--rx-surface-soft)]">
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
                          className={`px-5 py-3 text-xs font-bold uppercase tracking-wide text-[var(--rx-ink-secondary)] ${
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
                        className="border-t border-[var(--rx-surface-soft)] hover:bg-[var(--rx-surface-soft)]"
                      >
                        <td className="px-5 py-3">
                          <span className="rounded-md bg-[var(--rx-surface-soft)] px-2 py-1 font-mono text-xs font-semibold text-[var(--rx-ink-secondary)]">
                            {closing.folio}
                          </span>
                        </td>

                        <td className="px-5 py-3 text-[var(--rx-ink-secondary)]">
                          {closing.date}
                        </td>

                        <td className="px-5 py-3 text-[var(--rx-ink-secondary)]">
                          {closing.time}
                        </td>

                        <td className="px-5 py-3 text-right text-[var(--rx-ink-secondary)]">
                          {closing.salesCount}
                        </td>

                        <td className="px-5 py-3 text-right font-semibold text-[var(--rx-ink)]">
                          {formatCurrency(closing.totalSales)}
                        </td>

                        <td className="px-5 py-3 text-right text-[var(--rx-ink-secondary)]">
                          {formatCurrency(closing.initialFund)}
                        </td>

                        <td className="px-5 py-3 text-right text-[var(--rx-ink-secondary)]">
                          {formatCurrency(closing.expectedCash)}
                        </td>

                        <td className="px-5 py-3 text-right text-[var(--rx-ink-secondary)]">
                          {formatCurrency(closing.countedCash)}
                        </td>

                        <td
                          className={`px-5 py-3 text-right font-bold ${closingStatus.amountClassName}`}
                          title={closingStatus.label}
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
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-[var(--rx-line)] bg-[var(--rx-surface-soft)] p-4">
          <MaterialIcon
            name="info"
            className="mt-0.5 text-xl text-[var(--rx-ink)]"
            filled
          />

          <div>
            <p className="text-sm font-bold text-[var(--rx-ink)]">
              Alcance actual del corte
            </p>

            <p className="mt-0.5 text-xs leading-5 text-[var(--rx-ink-secondary)]">
              El corte calcula el fondo inicial, el efectivo esperado, el
              efectivo contado y la diferencia. Al confirmar el cierre se
              registra el corte y queda en el historial del turno. La
              impresión del comprobante aún no está disponible.
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
        emphasized ? "border-t border-[var(--rx-line)]" : ""
      }`}
    >
      <div>
        <p
          className={`text-sm ${
            emphasized
              ? "font-bold text-[var(--rx-ink)]"
              : "text-[var(--rx-ink-secondary)]"
          }`}
        >
          {label}
        </p>

        {hint && (
          <p className="mt-0.5 text-xs text-[var(--rx-ink-secondary)]">
            {hint}
          </p>
        )}
      </div>

      <p
        className={`flex-shrink-0 ${
          emphasized
            ? "text-base font-bold text-[var(--rx-ink)]"
            : "text-sm font-semibold text-[var(--rx-ink)]"
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

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = document.getElementById("closing-confirm-dialog");
    const buttons = dialog?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key === "Tab" && buttons?.length) {
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); previousFocus?.focus(); };
  }, [onCancel]);

  return (
    <div className="rx-modal-overlay">
      <div id="closing-confirm-dialog" className="rx-modal rx-closing-modal" role="dialog" aria-modal="true" aria-labelledby="closing-confirm-title" aria-describedby="closing-confirm-description">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--rx-surface-soft)]">
            <MaterialIcon
              name="lock_clock"
              className="text-3xl text-[var(--rx-ink)]"
              filled
            />
          </div>

          <h2 id="closing-confirm-title" className="mb-2 text-lg font-bold text-[var(--rx-ink)]">
            ¿Realizar el corte de caja?
          </h2>

          <p id="closing-confirm-description" className="text-sm leading-6 text-[var(--rx-ink-secondary)]">
            Se cerrará el turno con {salesCount} venta
            {salesCount === 1 ? "" : "s"} registrada
            {salesCount === 1 ? "" : "s"} y comenzará un turno nuevo.
          </p>
        </div>

        {/* Repaso el resultado del arqueo antes de confirmar. */}
        <div className="mb-5 space-y-2 rounded-xl border border-[var(--rx-line)] bg-[var(--rx-surface-soft)] p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--rx-ink-secondary)]">Total vendido</span>
            <strong className="text-[var(--rx-ink)]">
              {formatCurrency(totalSales)}
            </strong>
          </div>

          <div className="flex justify-between">
            <span className="text-[var(--rx-ink-secondary)]">Efectivo esperado</span>
            <strong className="text-[var(--rx-ink)]">
              {formatCurrency(expectedCash)}
            </strong>
          </div>

          <div className="flex justify-between">
            <span className="text-[var(--rx-ink-secondary)]">Efectivo contado</span>
            <strong className="text-[var(--rx-ink)]">
              {formatCurrency(countedCash)}
            </strong>
          </div>

          <div className="flex justify-between border-t border-[var(--rx-line)] pt-2">
            <span className="text-[var(--rx-ink-secondary)]">
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
            className="rx-btn rx-btn--outline rx-btn--block"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="rx-btn rx-btn--dark rx-btn--block"
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
    <article className="rx-card rx-closing-kpi">
      <div
        className={`rx-closing-kpi-icon ${iconClassName}`}
      >
        <MaterialIcon
          name={icon}
          className="text-xl"
          filled
        />
      </div>

      <div className="rx-closing-kpi-copy">
        <p className="rx-closing-kpi-value">{value}</p>
        <p className="rx-closing-kpi-label">{title}</p>
      </div>
    </article>
  );
}