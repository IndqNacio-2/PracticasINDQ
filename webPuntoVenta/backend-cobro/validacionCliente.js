// Correo obligatorio para registrar o reemplazar el correo de un cliente.
function esCorreoValido(valor, obligatorio = true) {
  if (valor === null || valor === undefined || valor === '') return !obligatorio;
  if (typeof valor !== 'string') return false;
  const correo = valor.trim();
  if (!correo) return !obligatorio;
  if (correo.length > 254) return false;
  const partes = correo.split('@');
  if (partes.length !== 2) return false;
  const [local, dominio] = partes;
  return local.length <= 64 && /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(local)
    && dominio.split('.').length >= 2
    && dominio.split('.').every(etiqueta => etiqueta.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(etiqueta));
}

function esNombreValido(valor) {
  return typeof valor === 'string' && /^(?:\p{L}\p{M}*| )+$/u.test(valor.normalize('NFC').trim())
    && (valor.match(/\p{L}/gu) ?? []).length >= 3;
}

function esTelefonoValido(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && /^[0-9]{0,10}$/.test(valor.trim()));
}

module.exports = { esCorreoValido, esNombreValido, esTelefonoValido };