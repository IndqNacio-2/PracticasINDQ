// ============================================================================
// Reservaciones: la fuente única es MongoDB (API administrativa).
//
// Cobro ya no guarda reservaciones propias: las crea, consulta, cancela, reagenda y marca como
// pagadas por /admin/api/reservaciones con la sesión de quien hace la petición. Las reglas de
// cupo, lista de espera, cancelación y asistencia viven allá (backend-administrativa), así que
// son las mismas para recepción, administrativa y la app móvil.
// Lo único que cobro conserva en Postgres es el pago (folio, método, efectivo, ticket) y las
// compras de membresía.
//
// Este módulo traduce una reservación de Mongo a la forma que usan las pantallas de cobro.
// ============================================================================
const horasDe = (horaClase) => String(horaClase ?? '').match(/\d{1,2}:\d{2}/g) ?? [];

// Estado que muestra el tablero de cobro.
const estadoCobro = (r) => {
  if (r.estatus === 'cancelada') return 'cancelado';
  if (r.estatus === 'no_asistio') return 'no_asistio';
  if (r.asistenciaConfirmada) return 'asistido';
  return r.estadoPago === 'pagado' ? 'pagado' : 'pendiente';
};

function aReservaCobro(r) {
  if (!r) return null;
  const [inicio = '', fin = ''] = horasDe(r.horaClase);
  const [inicioOriginal = ''] = horasDe(r.reagendadaDesde?.horaClase);
  return {
    id: r.idReservacion,
    client: r.nombreCliente,
    type: r.tipo ?? 'cliente',
    class: r.clase,
    membresiaCompraId: r.membresiaCompraId ? Number(r.membresiaCompraId) : null,
    claseId: r.claseId || null,
    clienteId: r.idCliente ?? null,
    paymentStatus: r.estadoPago ?? 'pendiente',
    horaFin: fin,
    attendanceStatus: r.asistenciaConfirmada ? 'asistido' : r.estatus === 'no_asistio' ? 'no_asistio' : 'pendiente',
    time: inicio,
    status: estadoCobro(r),
    price: Number(r.precio ?? 0),
    fecha: r.fechaClase,
    horarioId: r.idHorario,
    capacityStatus: r.estadoCupo ?? 'confirmada',
    codigo: r.codigo ?? null,
    origen: r.origen ?? 'recepcion',
    reagendada: Boolean(r.reagendada),
    fechaOriginal: r.reagendadaDesde?.fechaClase ?? null,
    horaOriginal: inicioOriginal || null,
    creadoEn: r.fechaCreacion,
  };
}

function crearReservasAdmin(adminApi) {
  const pedir = async (autorizacion, ruta, { metodo = 'GET', cuerpo } = {}) => {
    let respuesta;
    try {
      respuesta = await fetch(`${adminApi}${ruta}`, {
        method: metodo,
        headers: { Authorization: autorizacion ?? '', ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw Object.assign(new Error('Administrativa no está disponible. Intenta de nuevo en un momento.'), { status: 503 });
    }
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      throw Object.assign(new Error(datos.error || datos.message || 'Administrativa no pudo completar la operación.'), { status: respuesta.status });
    }
    return datos;
  };
  const conPromovida = (datos) => ({ reservacion: aReservaCobro(datos), promovida: aReservaCobro(datos.promovida) });

  return {
    async listar(autorizacion, filtros = {}) {
      const consulta = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== null && v !== ''));
      const lista = await pedir(autorizacion, `/reservaciones?${consulta}`);
      return (Array.isArray(lista) ? lista : []).map(aReservaCobro);
    },
    async porId(autorizacion, id) { return aReservaCobro(await pedir(autorizacion, `/reservaciones/${id}`)); },
    async porCodigo(autorizacion, codigo) { return aReservaCobro(await pedir(autorizacion, `/reservaciones/codigo/${encodeURIComponent(codigo)}`)); },
    async crear(autorizacion, cuerpo) { return aReservaCobro(await pedir(autorizacion, '/reservaciones', { metodo: 'POST', cuerpo })); },
    // Recepción puede cancelar hasta que empiece la clase (`forzar` salta la regla de las 24 horas del cliente).
    async cancelar(autorizacion, id) {
      return conPromovida(await pedir(autorizacion, `/reservaciones/${id}/cancelar`, { metodo: 'PATCH', cuerpo: { forzar: true } }));
    },
    async reagendar(autorizacion, id, idHorario) {
      return conPromovida(await pedir(autorizacion, `/reservaciones/${id}/reagendar`, { metodo: 'PATCH', cuerpo: { idHorario } }));
    },
    async asistencia(autorizacion, id) {
      return aReservaCobro(await pedir(autorizacion, `/reservaciones/${id}/asistencia`, { metodo: 'PATCH', cuerpo: {} }));
    },
    async pago(autorizacion, id, cuerpo) {
      return aReservaCobro(await pedir(autorizacion, `/reservaciones/${id}/pago`, { metodo: 'PATCH', cuerpo }));
    },
  };
}

module.exports = { aReservaCobro, crearReservasAdmin, estadoCobro };
