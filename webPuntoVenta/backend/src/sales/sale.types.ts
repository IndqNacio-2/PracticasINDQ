/**
 * Defino como se ve una venta dentro del backend
 *
 * uso el mismo formato que el frontend en src/types.ts (folio, date, time,
 * items, subtotal, discount, total, paymentMethod) para que el ticket, el
 * corte de caja y los reportes usen la respuesta sin convertir nada.
 */

// Formas de pago que acepta el sistema.
export type PayMethod = "efectivo" | "tarjeta" | "transferencia";

// Un articulo del carrito: producto y cuantas unidades se cobran.
export interface SaleItemInput {
  productId: number;
  quantity: number;
}

/**
 * Describo lo que acepto al registrar una venta
 *
 * no incluyo el folio, la fecha ni el total porque los calcula el
 * backend: el folio se genera solo y los precios se leen del catalogo
 * para que nadie pueda cobrar un precio distinto al registrado.
 */
export interface SaleInput {
  items: SaleItemInput[];
  discount: number;
  paymentMethod: PayMethod;
  cashReceived?: number;
  transferRef?: string;
  registeredBy: string;
}

// Un renglon del ticket, tal como lo muestra la pantalla.
export interface SaleItem {
  name: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface SaleRecord {
  folio: string;
  date: string;
  time: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PayMethod;
  cashReceived?: number;
  change?: number;
  transferRef?: string;
}

/**
 * Representa un error de validacion por campo
 * lo uso para responderle al cliente exactamente que dato viene mal
 */
export interface ValidationIssue {
  field: string;
  message: string;
}