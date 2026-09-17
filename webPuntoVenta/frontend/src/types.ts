export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  emoji: string;
  bgColor: string;
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

export type AppModule =
  | "sale"
  | "inventory"
  | "waste"
  | "cash-closing"
  | "reports";