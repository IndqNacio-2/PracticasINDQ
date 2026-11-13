// Conserva la clave anterior para recuperar el fondo ya anotado por el vendedor.
const key = (userId: string) => `pos:fondo-recordatorio:${userId}`;

export function leerFondoVendedor(userId: string): number | null {
  const value = localStorage.getItem(key(userId));
  const amount = value === null ? NaN : Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function guardarFondoVendedor(userId: string, amount: number | null): void {
  if (amount === null) localStorage.removeItem(key(userId));
  else {
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Fondo inicial inválido.');
    localStorage.setItem(key(userId), String(amount));
  }
}