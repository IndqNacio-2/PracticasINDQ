// Campos opcionales: omitir en PATCH conserva lo almacenado; [] lo limpia.
function normalizarSalud(body = {}) {
  const salud = {};
  for (const campo of ['enfermedades', 'lesiones']) {
    if (body[campo] === undefined) continue;
    const lista = body[campo];
    if (!Array.isArray(lista) || lista.some(item => typeof item !== 'string' || !item.trim() || item.trim().length > 60)) {
      throw new Error(`${campo}: envía una lista de textos de 1 a 60 caracteres.`);
    }
    const vistos = new Set();
    salud[campo] = lista.map(item => item.trim()).filter(item => {
      const clave = item.toLocaleLowerCase();
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    });
  }
  return salud;
}
module.exports = { normalizarSalud };