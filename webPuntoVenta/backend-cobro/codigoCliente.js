function normalizarCodigoCliente(valor, id) {
  if (valor === undefined) return undefined;
  if (valor === null || valor === '') return null;
  if (typeof valor !== 'string') throw new Error('El código de usuario debe ser un texto.');
  const codigo = valor.trim().toUpperCase();
  if (!codigo) return null;
  if (!/^[A-Z0-9][A-Z0-9-]{2,29}$/.test(codigo)) throw new Error('El código debe tener de 3 a 30 caracteres: letras, números o guiones.');
  if (/^\d+$/.test(codigo) || codigo.startsWith('EMP-') || codigo.startsWith('CLI-')) {
    if (id && codigo === `CLI-${id}`) return null;
    throw new Error('Los códigos numéricos y los prefijos CLI- y EMP- están reservados. Usa otro código, por ejemplo SOC-123.');
  }
  return codigo;
}

module.exports = { normalizarCodigoCliente };