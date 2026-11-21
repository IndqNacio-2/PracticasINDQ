// ============================================================================
// Clientes: la fuente única es MongoDB (API administrativa).
//
// Cobro ya no guarda clientes propios: los consulta por /admin/api/clientes con la sesión
// de quien hace la petición. Sus tablas (reservas, pagos, compras de membresía) apuntan al
// cliente con su id de Mongo en la columna cliente_ref (texto, sin llave foránea).
// ============================================================================
const ID_CLIENTE = /^[a-f\d]{24}$/i;
const esIdCliente = (valor) => typeof valor === 'string' && ID_CLIENTE.test(valor);

function crearClientesAdmin(adminApi) {
  const aSocio = (c) => ({
    id: String(c.idUsuario ?? c._id),
    codigo: c.codigoAcceso,
    nombre: [c.nombre, c.apellidos].filter(Boolean).join(' ').trim(),
    activo: c.estatus === 'activo',
    correo: c.correo ?? null,
    telefono: c.telefono ?? null,
  });

  const pedir = async (ruta, autorizacion) => {
    const respuesta = await fetch(`${adminApi}${ruta}`, {
      headers: { Authorization: autorizacion ?? '' },
      signal: AbortSignal.timeout(8000),
    });
    if (respuesta.status === 404) return null;
    if (!respuesta.ok) {
      throw Object.assign(new Error('No se pudo consultar al cliente en administrativa.'), { status: 503 });
    }
    return respuesta.json();
  };

  return {
    esIdCliente,
    /** Cliente por id de Mongo, o null si no existe. Lanza error con status 503 si administrativa no responde. */
    async obtenerSocio(id, autorizacion) {
      if (!esIdCliente(id)) return null;
      const c = await pedir(`/clientes/${id}`, autorizacion);
      return c ? aSocio(c) : null;
    },
    /** Cliente por su código de acceso (CLI001), o null. */
    async buscarPorCodigo(codigo, autorizacion) {
      const lista = await pedir(`/clientes?codigoAcceso=${encodeURIComponent(codigo)}`, autorizacion);
      return Array.isArray(lista) && lista[0] ? aSocio(lista[0]) : null;
    },
  };
}

module.exports = { crearClientesAdmin, esIdCliente };
