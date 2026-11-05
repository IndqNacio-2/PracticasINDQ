// Reglas reutilizables sin abrir conexiones ni arrancar el servidor.
function puedeConfirmarAsistencia(reserva) {
  return reserva.paymentStatus === 'pagado'
    && ['pendiente', 'pagado'].includes(reserva.status)
    && reserva.capacityStatus !== 'espera';
}

function marcaLocal(fecha) {
  const dos = n => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())} ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

async function marcarInasistencias(db, ahora = new Date()) {
  const resultado = await db.query(
    `UPDATE webcobro.reservas SET estado = 'no_asistio'
      WHERE estado IN ('pendiente', 'pagado') AND estado_cupo = 'confirmada'
        AND fecha <> ''
        AND ((hora_fin <> '' AND (fecha || ' ' || hora_fin) <= $1)
          OR (hora_fin = '' AND (fecha || ' ' || hora) < $2))`,
    [marcaLocal(ahora), marcaLocal(new Date(ahora.getTime() - 15 * 60000))],
  );
  return resultado.rowCount;
}

module.exports = { puedeConfirmarAsistencia, marcarInasistencias };