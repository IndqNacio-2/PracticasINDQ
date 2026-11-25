import type { PaymentMethod, SaleRecord } from '../types';

export function paymentAmount(sale: SaleRecord, method: PaymentMethod): number {
  return sale.payments?.length
    ? sale.payments.filter(part => part.method === method).reduce((sum, part) => sum + part.amount, 0)
    : sale.paymentMethod === method ? sale.total : 0;
}