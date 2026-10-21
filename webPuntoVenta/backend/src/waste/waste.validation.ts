/**
 * Aqui valido los datos de una merma antes de tocar la base
 *
 * las mismas reglas que ya aplica el formulario del frontend, para que
 * la API no guarde nada que la pantalla no permitiria.
 */

import type {
  ValidationIssue,
  WasteInput,
  WasteReason,
} from "./waste.types.js";

// Los motivos que acepto, iguales a los del formulario.
const WASTE_REASONS: WasteReason[] = [
  "damaged",
  "expired",
  "broken",
  "internal-use",
  "inventory-error",
  "lost",
  "other",
];

/**
 * Reviso el cuerpo de la peticion campo por campo.
 *
 * devuelvo la lista de errores y el dato ya limpio; si algo viene mal,
 * input queda en null y las rutas responden 400 con los mensajes.
 */
export function validateWasteInput(body: unknown): {
  issues: ValidationIssue[];
  input: WasteInput | null;
} {
  const issues: ValidationIssue[] = [];
  const data = (body ?? {}) as Record<string, unknown>;

  // Producto relacionado con la merma.
  const productId = Number(data.productId);
  if (!Number.isInteger(productId) || productId <= 0) {
    issues.push({
      field: "productId",
      message: "El producto es obligatorio.",
    });
  }

  // Cantidad: entero mayor que cero, igual que en el formulario.
  const quantity = Number(data.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    issues.push({
      field: "quantity",
      message: "La cantidad debe ser un numero entero mayor que cero.",
    });
  }

  // Motivo: solo los que maneja el sistema.
  const reason = String(data.reason ?? "");
  if (!WASTE_REASONS.includes(reason as WasteReason)) {
    issues.push({
      field: "reason",
      message: "El motivo de la merma no es valido.",
    });
  }

  // Observaciones: texto libre, pero limitado al tamano de la columna.
  const observations = String(data.observations ?? "").trim();
  if (observations.length > 300) {
    issues.push({
      field: "observations",
      message: "Las observaciones no pueden pasar de 300 caracteres.",
    });
  }

  // Usuario que registra: todavia no hay inicio de sesion, asi que si no
  // viene lo dejo vacio y la base pone el valor por omision.
  const registeredBy =
    String(data.registeredBy ?? "").trim() || "Edgar Rodriguez";

  if (issues.length > 0) {
    return { issues, input: null };
  }

  return {
    issues,
    input: {
      productId,
      quantity,
      reason: reason as WasteReason,
      observations,
      registeredBy,
    },
  };
}