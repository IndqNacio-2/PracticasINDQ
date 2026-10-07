/**
 * Defino como se ve una merma dentro del backend
 *
 * uso camelCase (productId, createdAt) igual que el frontend en
 * src/types.ts, aunque en la base las columnas van en snake_case,
 * asi el modulo de Mermas usa la respuesta sin convertir.
 */

// Motivos permitidos, los mismos que maneja el formulario.
export type WasteReason =
  | "damaged"
  | "expired"
  | "broken"
  | "internal-use"
  | "inventory-error"
  | "lost"
  | "other";

export interface WasteRecord {
  id: number;
  folio: string;
  productId: number;
  quantity: number;
  reason: WasteReason;
  observations: string;
  createdAt: string;
  registeredBy: string;
}

/**
 * Describo lo que acepto al registrar una merma
 *
 * no incluyo el folio ni el id porque los genera la base, y tampoco el
 * costo porque lo tomo del producto en ese momento.
 */
export interface WasteInput {
  productId: number;
  quantity: number;
  reason: WasteReason;
  observations: string;
  registeredBy: string;
}

/**
 * Representa un error de validacion por campo
 * lo uso para responderle al cliente exactamente que dato viene mal
 */
export interface ValidationIssue {
  field: string;
  message: string;
}