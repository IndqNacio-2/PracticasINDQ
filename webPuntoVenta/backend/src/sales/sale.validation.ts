/**
 * Aqui valido los datos de una venta antes de tocar la base
 *
 * reviso que el carrito no venga vacio, que cada articulo traiga su
 * producto y su cantidad, y que la forma de pago sea una de las tres que
 * maneja el sistema.
 */

import type {
  PayMethod,
  SaleInput,
  ValidationIssue,
} from "./sale.types.js";

// Las formas de pago que acepto.
const PAY_METHODS: PayMethod[] = ["efectivo", "tarjeta", "transferencia"];

export function validateSaleInput(body: unknown): {
  issues: ValidationIssue[];
  input: SaleInput | null;
} {
  const issues: ValidationIssue[] = [];
  const data = (body ?? {}) as Record<string, unknown>;

  // El carrito debe traer al menos un articulo.
  const rawItems = Array.isArray(data.items) ? data.items : [];
  if (rawItems.length === 0) {
    issues.push({
      field: "items",
      message: "La venta debe tener al menos un producto.",
    });
  }

  // Reviso cada articulo del carrito.
  const items = rawItems.map((rawItem) => {
    const item = (rawItem ?? {}) as Record<string, unknown>;
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(productId) || productId <= 0) {
      issues.push({
        field: "items",
        message: "Cada articulo debe tener un producto valido.",
      });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      issues.push({
        field: "items",
        message: "Cada articulo debe tener una cantidad mayor que cero.",
      });
    }

    return { productId, quantity };
  });

  // Forma de pago.
  const paymentMethod = String(data.paymentMethod ?? "");
  if (!PAY_METHODS.includes(paymentMethod as PayMethod)) {
    issues.push({
      field: "paymentMethod",
      message: "La forma de pago no es valida.",
    });
  }

  // Descuento: puede ir vacio, pero si viene debe ser un numero sin negativos.
  const discount = data.discount === undefined ? 0 : Number(data.discount);
  if (!Number.isFinite(discount) || discount < 0) {
    issues.push({
      field: "discount",
      message: "El descuento no puede ser negativo.",
    });
  }

  // Efectivo recibido: solo aplica cuando se paga en efectivo.
  const cashReceived =
    data.cashReceived === undefined || data.cashReceived === null
      ? undefined
      : Number(data.cashReceived);
  if (cashReceived !== undefined && (!Number.isFinite(cashReceived) || cashReceived < 0)) {
    issues.push({
      field: "cashReceived",
      message: "El efectivo recibido no es valido.",
    });
  }

  // Referencia de la transferencia, cuando se cobra asi.
  const transferRef =
    data.transferRef === undefined ? undefined : String(data.transferRef).trim();

  // Usuario que cobra: todavia no hay inicio de sesion.
  const registeredBy =
    String(data.registeredBy ?? "").trim() || "Edgar Rodriguez";

  if (issues.length > 0) {
    return { issues, input: null };
  }

  return {
    issues,
    input: {
      items,
      discount,
      paymentMethod: paymentMethod as PayMethod,
      cashReceived,
      transferRef,
      registeredBy,
    },
  };
}