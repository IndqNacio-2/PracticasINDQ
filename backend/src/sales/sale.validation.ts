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
const PAY_METHODS: PayMethod[] = ["efectivo", "tarjeta", "transferencia", "mixto"];

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

  // La identidad se asigna exclusivamente con el token en la ruta.
  const registeredBy = '';

  let payments: SaleInput['payments'];
  if (paymentMethod === 'mixto') {
    const parts = Array.isArray(data.payments) ? data.payments : [];
    const methods = new Set<string>();
    payments = [];
    if (parts.length < 2 || parts.length > 3) issues.push({ field: 'payments', message: 'El pago mixto requiere dos o tres métodos.' });
    for (const part of parts) {
      const p = (part ?? {}) as Record<string, unknown>;
      if (!['efectivo', 'tarjeta', 'transferencia'].includes(String(p.method)) || methods.has(String(p.method)) ||
          typeof p.amount !== 'number' || !Number.isFinite(p.amount) || p.amount <= 0 ||
          !Number.isSafeInteger(Math.round(p.amount * 100)) || Math.abs(p.amount * 100 - Math.round(p.amount * 100)) > 0.000001) {
        issues.push({ field: 'payments', message: 'Usa métodos distintos e importes positivos con máximo dos decimales.' });
      } else payments.push({ method: p.method as 'efectivo' | 'tarjeta' | 'transferencia', amount: p.amount });
      methods.add(String(p.method));
    }
  } else if (data.payments !== undefined) {
    issues.push({ field: 'payments', message: 'El desglose solo se envía con el método mixto.' });
  }

  if (issues.length > 0) {
    return { issues, input: null };
  }

  return {
    issues,
    input: {
      items,
      discount,
      paymentMethod: paymentMethod as PayMethod,
      payments,
      cashReceived,
      transferRef,
      registeredBy,
    },
  };
}