/**
 * Estados administrativos que puede tener un producto
 * 
 * un producto inactivo permanece en el inventario, pero no debe
 * aparecer disponible para vender en el punto de venta
 */
export type ProductStatus = "active" | "inactive";

/**
 * Representa un prodcuto disponible dentro de la aplicacion
 */
export interface Product {
  // Identificacdor interno temporal
  id: number;
  // codigo o SKU para localizar el producto
  code: string;
  // Nombre que vera el usuario
  name: string;
  // Descripción breve para consultar los detalles del producto
  description: string;
  // Categoria utilizada en los filtros
  category: string;
  // Precio que paga el cliente
  price: number;
  // costo estimado que tuvo el producto para el negocio
  cost: number;
  // cantidad disponible actualmente
  stock: number;
  // cantidad a partir de la cual se considera stock bajo
  minimumStock: number;
  // determinar si el producto puede venderse
  status: ProductStatus;
  // nombre del material symbol utilizando en la interfaz
  icon: string;
  // color de fondo utilizando en la tarjeta del producto
  bgColor: string;
}

/**
 * Defino los motivos disponibles para registrar una merma
 * 
 * utilizo valores en ingles internamente para mantenerlos cortos.
 */
export type WasteReason =
  | "damaged"
  | "expired"
  | "broken"
  | "internal-use"
  | "inventory-error"
  | "lost"
  | "other"

/**
 * Represento un registro de pérdida o merma de inventario.
 */
export interface WasteRecord {
  // Identificador interno temporal del registro.
  id: number;

  // Folio visible para localizar la merma.
  folio: string;

  // Producto relacionado con la pérdida.
  productId: number;

  // Cantidad de unidades registradas como merma.
  quantity: number;

  // Motivo seleccionado por el usuario.
  reason: WasteReason;

  // Explicación adicional opcional.
  observations: string;

  // Fecha y hora del registro.
  createdAt: string;

  // Usuario que realizó el movimiento.
  registeredBy: string;
}

export interface CartItem {
  productId: number;
  quantity: number;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export interface SaleRecord {
  folio: string;
  date: string;
  time: string;
  items: Array<{ name: string; qty: number; unitPrice: number; subtotal: number }>;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'efectivo' | 'tarjeta' | 'transferencia';
  cashReceived?: number;
  change?: number;
  transferRef?: string;
}

/**
 * Represento un corte de caja realizado al cerrar un turno.
 */
export interface CashClosingRecord {
  // Folio visible para localizar el corte.
  folio: string;

  // Fecha y hora en que se realizó el cierre.
  date: string;
  time: string;

  // Cantidad de ventas incluidas en el turno.
  salesCount: number;

  // Importe total vendido durante el turno.
  totalSales: number;

  // Importes separados por método de pago.
  cashSales: number;
  cardSales: number;
  transferSales: number;

  // Dinero con el que inició el turno.
  initialFund: number;

  // Efectivo que debía existir en la caja.
  expectedCash: number;

  // Efectivo que el usuario contó al final del turno.
  countedCash: number;

  // Resultado de restar el efectivo esperado al efectivo contado.
  difference: number;

  // Usuario que realizó el corte.
  registeredBy: string;
}

export type AppModule =
  | "sale"
  | "inventory"
  | "waste"
  | "cash-closing"
  | "reports";