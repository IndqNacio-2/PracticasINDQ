/**
 * Defino como se ve un corte de caja dentro del backend
 *
 * uso camelCase igual que el frontend en src/types.ts (salesCount,
 * totalSales, initialFund, countedCash, difference), asi la pantalla del
 * Corte de caja usa la respuesta sin convertir.
 */

export interface CashClosingRecord {
  folio: string;
  date: string;
  time: string;
  salesCount: number;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  initialFund: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  registeredBy: string;
}

/**
 * Describo lo que acepto al registrar un corte
 *
 * no incluyo el folio ni la fecha porque los genera el backend.
 */
export interface CashClosingInput {
  salesCount: number;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  initialFund: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  registeredBy: string;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

/** Reviso que los importes y las cantidades del corte sean validos. */
export function validateCashClosingInput(body: unknown): {
  issues: ValidationIssue[];
  input: CashClosingInput | null;
} {
  const issues: ValidationIssue[] = [];
  const data = (body ?? {}) as Record<string, unknown>;

  // Campos que deben ser numeros y no pueden ser negativos.
  const camposSinNegativos = [
    "salesCount",
    "totalSales",
    "cashSales",
    "cardSales",
    "transferSales",
    "initialFund",
    "expectedCash",
    "countedCash",
  ] as const;

  const valores: Record<string, number> = {};

  for (const campo of camposSinNegativos) {
    const valor = Number(data[campo] ?? 0);

    if (!Number.isFinite(valor) || valor < 0) {
      issues.push({
        field: campo,
        message: `El campo ${campo} debe ser un numero sin negativos.`,
      });
    }

    valores[campo] = valor;
  }

  // La diferencia si puede ser negativa, porque significa faltante.
  const difference = Number(data.difference ?? 0);
  if (!Number.isFinite(difference)) {
    issues.push({
      field: "difference",
      message: "La diferencia debe ser un numero.",
    });
  }

  // Usuario que realiza el corte: todavia no hay inicio de sesion.
  const registeredBy =
    String(data.registeredBy ?? "").trim() || "Edgar Rodriguez";

  if (issues.length > 0) {
    return { issues, input: null };
  }

  return {
    issues,
    input: { ...valores, difference, registeredBy } as CashClosingInput,
  };
}