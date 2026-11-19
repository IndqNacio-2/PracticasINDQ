const { esNombreValido } = require('./validacionCliente');

function normalizarMenor(datos, existente = {}, hoy = new Date()) {
  const fechaNacimiento = datos.fechaNacimiento === undefined
    ? existente.fechaNacimiento || '' : datos.fechaNacimiento;
  if (typeof fechaNacimiento !== 'string') throw new Error('La fecha de nacimiento no es válida.');
  const fecha = new Date(`${fechaNacimiento}T12:00:00`);
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  if (fechaNacimiento && (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento) || Number.isNaN(fecha.getTime()) || fecha.getFullYear() !== Number(fechaNacimiento.slice(0, 4)) || fecha.getMonth() + 1 !== Number(fechaNacimiento.slice(5, 7)) || fecha.getDate() !== Number(fechaNacimiento.slice(8, 10)) || fechaNacimiento > hoyISO)) {
    throw new Error('La fecha de nacimiento no es válida o está en el futuro.');
  }
  const edad = fechaNacimiento ? hoy.getFullYear() - fecha.getFullYear() - (hoyISO.slice(5) < fechaNacimiento.slice(5) ? 1 : 0) : null;
  const resultado = { fechaNacimiento };
  for (const campo of ['nombreTutor', 'claveElectorTutor', 'estadoDocumentacion']) {
    const valor = datos[campo] === undefined ? existente[campo] ?? (campo === 'estadoDocumentacion' ? 'pendiente' : '') : datos[campo];
    if (typeof valor !== 'string') throw new Error('Los datos del tutor y la documentación no son válidos.');
    resultado[campo] = valor.trim();
  }
  if (!['pendiente', 'validada'].includes(resultado.estadoDocumentacion)) throw new Error('El estado documental no es válido.');
  if (resultado.nombreTutor.length > 200 || resultado.claveElectorTutor.length > 30) throw new Error('Los datos del tutor exceden la longitud permitida.');
  if (edad !== null && edad < 18) {
    if (!esNombreValido(resultado.nombreTutor) || resultado.nombreTutor.split(/\s+/).length < 2) throw new Error('El nombre completo del tutor es obligatorio para menores.');
    if (!/^[A-Z0-9]{18}$/i.test(resultado.claveElectorTutor)) throw new Error('La clave de elector del tutor debe contener 18 letras o números.');
  }
  resultado.claveElectorTutor = resultado.claveElectorTutor.toUpperCase();
  return resultado;
}

module.exports = { normalizarMenor };