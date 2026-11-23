const error = message => Object.assign(new Error(message), { status: 400 });
function centavos(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+(\.\d{1,2})?$/.test(String(value))) throw error('Importe inválido: usa hasta dos decimales.');
  const n = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(n) || n < 0 || n > 9999999999) throw error('Importe fuera de rango.');
  return n;
}
function validarMixto(body, total) {
  const pagos = body.payments;
  if (!Array.isArray(pagos) || pagos.length !== 2) throw error('El pago mixto requiere efectivo y tarjeta o transferencia.');
  const efectivo = pagos.find(p => p?.method === 'efectivo');
  const electronico = pagos.find(p => ['tarjeta', 'transferencia'].includes(p?.method));
  if (!efectivo || !electronico) throw error('Selecciona efectivo y un método para el restante.');
  const a = centavos(efectivo.amount), b = centavos(electronico.amount);
  if (a <= 0 || b <= 0 || a + b !== centavos(total)) throw error('El desglose debe cubrir exactamente el total con dos importes positivos.');
  const recibido = centavos(body.efectivoRecibido);
  if (recibido < a) throw error('El efectivo recibido no cubre la parte en efectivo.');
  return { pagos: [{ metodo: 'efectivo', monto: a / 100 }, { metodo: electronico.method, monto: b / 100 }],
    efectivoRecibido: recibido / 100, cambio: (recibido - a) / 100,
    referencia: electronico.method === 'transferencia' ? String(body.referencia ?? '').trim() : null };
}
module.exports = { validarMixto };