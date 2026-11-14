// Correo opcional en Recepción; si se proporciona debe tener formato válido.
function esCorreoValido(valor, obligatorio = false) {
  if (valor === null || valor === undefined || valor === '') return !obligatorio;
  return typeof valor === 'string' && (valor.trim() === '' ? !obligatorio : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim()));
}
module.exports = { esCorreoValido };