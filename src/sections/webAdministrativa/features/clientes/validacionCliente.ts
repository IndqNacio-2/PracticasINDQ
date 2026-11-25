export function errorCodigoCliente(valor = '', id?: number): string {
  const codigo = valor.trim().toUpperCase();
  if (!codigo || (id && codigo === `CLI-${id}`)) return '';
  if (!/^[A-Z0-9][A-Z0-9-]{2,29}$/.test(codigo)) return 'El código debe tener de 3 a 30 caracteres: letras, números o guiones.';
  if (/^\d+$/.test(codigo) || codigo.startsWith('CLI-') || codigo.startsWith('EMP-')) return 'Los códigos numéricos y los prefijos CLI- y EMP- están reservados. Usa otro código, por ejemplo SOC-123.';
  return '';
}

export function esNombreValido(valor: string) {
  return /^(?:\p{L}\p{M}*| )+$/u.test(valor.normalize('NFC').trim())
    && (valor.match(/\p{L}/gu) ?? []).length >= 3;
}

export function esTelefonoValido(valor: string) {
  return /^[0-9]{0,10}$/.test(valor.trim());
}

export function esCorreoValido(valor: string) {
  const correo = valor.trim();
  if (!correo) return false;
  if (correo.length > 254) return false;
  const partes = correo.split('@');
  if (partes.length !== 2) return false;
  const [local, dominio] = partes;
  return local.length <= 64 && /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(local)
    && dominio.split('.').length >= 2
    && dominio.split('.').every(etiqueta => etiqueta.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(etiqueta));
}