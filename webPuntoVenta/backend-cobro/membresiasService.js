// ============================================================================
// Venta y cobro de membresías en recepción.
//
// Las compras de membresía viven en MongoDB (administrativa), con las mismas reglas para cobro, la web
// administrativa y la app móvil: aquí NO se calculan saldos ni vigencias. Cobro conserva en Postgres solo el
// PAGO (folio, método, efectivo, ticket) y lo enlaza con la compra por el folio.
//   - Venta directa en recepción: se cotiza en administrativa, se registra el pago y se crea la compra activa.
//   - Membresía apartada desde la app (código PQ-XXXXX): recepción la busca por código, la cobra y se activa.
// El folio del pago sale de la solicitud (o de la compra apartada), así un reintento retoma el mismo pago y nunca
// cobra dos veces.
// ============================================================================
const crypto = require('node:crypto');
const { imprimirTicket } = require('./ticketService');
const { crearClientesAdmin } = require('./clientesAdmin');

function fallo(message, status = 409) { return Object.assign(new Error(message), { status }); }

// Folio determinista (MEM-XXXXXXXXXXXXXXXX): la misma solicitud o compra siempre produce el mismo folio.
const folioDe = (clave) => `MEM-${crypto.createHash('sha256').update(String(clave)).digest('hex').slice(0, 16).toUpperCase()}`;

function ticketCompra(compra, pago) {
  return {
    contexto: 'membresia', folio: pago.folio, fecha: new Date(pago.creado_en).toISOString(), cliente: pago.cliente_nombre || compra.nombreCliente,
    usuario: pago.usuario, metodoPago: pago.metodo_pago, total: Number(pago.monto),
    efectivoRecibido: pago.efectivo_recibido == null ? null : Number(pago.efectivo_recibido),
    cambio: pago.cambio == null ? null : Number(pago.cambio), referencia: pago.referencia,
    membresia: compra.condiciones.nombre, fechaInicio: compra.fechaInicio, fechaFin: compra.fechaFin,
    codigo: compra.codigo,
    items: [{ descripcion: `Membresía ${compra.condiciones.nombre}`, cantidad: 1, precioUnitario: Number(pago.monto), importe: Number(pago.monto) }],
  };
}

function registrarRutas(app, pool, adminApi) {
  const clientesAdmin = crearClientesAdmin(adminApi);

  // Llama a administrativa con la sesión de quien cobra y traduce sus errores de regla.
  async function admin(autorizacion, ruta, { metodo = 'GET', cuerpo } = {}) {
    let respuesta;
    try {
      respuesta = await fetch(`${adminApi}${ruta}`, {
        method: metodo,
        headers: { Authorization: autorizacion ?? '', ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        signal: AbortSignal.timeout(10000),
      });
    } catch { throw fallo('Administrativa no está disponible. Intenta de nuevo en un momento.', 503); }
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw fallo(datos.error || datos.message || 'Administrativa no pudo completar la operación.', respuesta.status);
    return datos;
  }

  async function personal(req, res, next) {
    try {
      if (!req.headers.authorization?.startsWith('Bearer ')) return res.status(401).json({ error: 'Inicia sesión para operar membresías.' });
      const r = await fetch(`${adminApi}/auth/me`, { headers: { Authorization: req.headers.authorization }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) return res.status(r.status === 401 ? 401 : 503).json({ error: 'No se pudo validar tu sesión.' });
      const { user } = await r.json();
      if (!user || !['administrador', 'recepcion'].includes(user.rol) || user.estatus !== 'activo') return res.status(403).json({ error: 'No tienes permiso para vender membresías.' });
      req.personalMembresias = user;
      next();
    } catch { res.status(503).json({ error: 'Administración no está disponible para validar la sesión.' }); }
  }

  const responder = (res, e, generico) => {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(generico, e);
    return res.status(500).json({ error: generico });
  };

  // Valida el método de pago y calcula el cambio. Devuelve { metodo, recibido, cambio, referencia }.
  function datosDePago(b, monto) {
    if (!['efectivo', 'tarjeta', 'transferencia'].includes(b.metodoPago)) throw fallo('Método de pago inválido.', 400);
    const recibido = b.efectivoRecibido;
    if (b.metodoPago === 'efectivo' && (typeof recibido !== 'number' || !Number.isFinite(recibido) || recibido < monto)) {
      throw fallo('El efectivo recibido no cubre el total.', 400);
    }
    return {
      metodo: b.metodoPago,
      recibido: b.metodoPago === 'efectivo' ? recibido : null,
      cambio: b.metodoPago === 'efectivo' ? Math.round((recibido - monto) * 100) / 100 : null,
      referencia: b.metodoPago === 'transferencia' ? String(b.referencia || '').slice(0, 200) : null,
    };
  }

  // Registra el pago una sola vez por folio: si ya existe (un intento anterior quedó a medias) se retoma ese.
  async function asegurarPago({ folio, monto, clienteRef, clienteNombre, pago, usuario }) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [folio]);
      let fila = (await db.query('SELECT * FROM webcobro.pagos WHERE folio = $1', [folio])).rows[0];
      if (!fila) {
        fila = (await db.query(`INSERT INTO webcobro.pagos
          (cliente_ref, cliente_nombre, monto, metodo_pago, efectivo_recibido, cambio, referencia, folio, usuario)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [clienteRef, clienteNombre, monto, pago.metodo, pago.recibido, pago.cambio, pago.referencia, folio, usuario])).rows[0];
      }
      await db.query('COMMIT');
      return fila;
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    } finally { db.release(); }
  }

  const nombreDe = (req) => `${req.personalMembresias.nombre} ${req.personalMembresias.apellidos || ''}`.trim();
  const pagoDeFolio = async (folio) => (await pool.query('SELECT * FROM webcobro.pagos WHERE folio = $1', [folio])).rows[0];

  // ---------- Consultas ----------

  app.get('/api/membresias/catalogo', personal, async (req, res) => {
    try {
      const catalogo = await admin(req.headers.authorization, '/membresias?estatus=activo');
      res.json(catalogo.filter(m => m.clasesIds?.length));
    } catch (e) { res.status(e.status || 503).json({ error: e.message }); }
  });

  // { <idCliente>: { tieneCompras, membresiasCompradas } }: lo que muestra la lista de clientes.
  app.get('/api/membresias/compras-resumen', personal, async (req, res) => {
    try { res.json(await admin(req.headers.authorization, '/membresias-compras/resumen')); }
    catch (e) { responder(res, e, 'No se pudo consultar el resumen de compras.'); }
  });

  // Compras pagadas de un cliente con su saldo (consumidas, apartadas y disponibles).
  app.get('/api/clientes/:id/membresias', personal, async (req, res) => {
    const id = req.params.id;
    if (!clientesAdmin.esIdCliente(id)) return res.status(400).json({ error: 'Cliente inválido.' });
    try {
      const compras = await admin(req.headers.authorization, `/membresias-compras/cliente/${id}`);
      res.json(compras.filter(c => c.estado === 'activa').map(c => ({
        id: c.idCompra, nombre: c.condiciones.nombre, clasesIds: c.condiciones.clasesIds,
        fechaInicio: c.fechaInicio, fechaFin: c.fechaFin, folio: c.folioPago, codigo: c.codigo,
        vigente: c.vigencia === 'vigente', saldos: c.saldos,
      })));
    } catch (e) { responder(res, e, 'No se pudo consultar el saldo.'); }
  });

  // Membresía apartada (o ya pagada) por su código PQ-XXXXX.
  app.get('/api/membresias/codigo/:codigo', personal, async (req, res) => {
    try { res.json(await admin(req.headers.authorization, `/membresias-compras/codigo/${encodeURIComponent(req.params.codigo)}`)); }
    catch (e) { responder(res, e, 'No se pudo consultar la membresía.'); }
  });

  app.get('/api/membresias/compras/:id/ticket', personal, async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'Compra inválida.' });
    try {
      const compra = await admin(req.headers.authorization, `/membresias-compras/${req.params.id}`);
      const pago = compra.folioPago ? await pagoDeFolio(compra.folioPago) : null;
      if (!pago) return res.status(404).json({ error: 'Esta compra todavía no tiene un pago registrado.' });
      res.json(ticketCompra(compra, pago));
    } catch (e) { responder(res, e, 'No se pudo recuperar el ticket.'); }
  });

  // ---------- Venta directa en recepción ----------

  app.post('/api/membresias/compras', personal, async (req, res) => {
    const b = req.body || {};
    if (!clientesAdmin.esIdCliente(b.clienteId) || !/^[a-f\d]{24}$/i.test(b.membresiaId || '')
      || typeof b.opcionId !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(b.solicitudId || '')) {
      return res.status(400).json({ error: 'Selecciona cliente, membresía y opción válidos.' });
    }
    try {
      const aut = req.headers.authorization;
      // Reintento: la misma solicitud ya creó la compra, se devuelve (sin cobrar de nuevo).
      const previas = await admin(aut, `/membresias-compras?solicitudId=${encodeURIComponent(b.solicitudId)}`);
      if (previas[0]) {
        const previa = previas[0];
        if (previa.idCliente !== b.clienteId || previa.idMembresia !== b.membresiaId || previa.idOpcion !== b.opcionId) {
          throw fallo('Esta solicitud ya fue utilizada para otra compra.');
        }
        const pago = await pagoDeFolio(previa.folioPago);
        return res.json({ compraId: previa.idCompra, ticket: ticketCompra(previa, pago) });
      }

      // Precio y vigencia salen del catálogo en administrativa; nunca de lo que mande el navegador.
      const cotizacion = await admin(aut, '/membresias-compras/cotizar', {
        metodo: 'POST',
        cuerpo: { idCliente: b.clienteId, idMembresia: b.membresiaId, idOpcion: b.opcionId, fechaInicio: b.fechaInicio },
      });
      const pagoDatos = datosDePago(b, cotizacion.precio);

      // 1) El pago se guarda primero en cobro (es el registro del dinero).
      const pago = await asegurarPago({
        folio: folioDe(b.solicitudId), monto: cotizacion.precio, clienteRef: b.clienteId,
        clienteNombre: cotizacion.nombreCliente, pago: pagoDatos, usuario: nombreDe(req),
      });
      // 2) Se crea la compra activa en administrativa, enlazada al pago por su folio.
      let compra;
      try {
        compra = await admin(aut, '/membresias-compras', {
          metodo: 'POST',
          cuerpo: {
            idCliente: b.clienteId, idMembresia: b.membresiaId, idOpcion: b.opcionId, estado: 'activa', origen: 'recepcion',
            solicitudId: b.solicitudId, fechaInicio: cotizacion.fechaInicio, metodoPago: pago.metodo_pago, folioPago: pago.folio,
          },
        });
      } catch (e) {
        throw fallo(`El cobro se registró con el folio ${pago.folio}, pero no se pudo crear la compra (${e.message}). Reintenta la venta: no se cobrará dos veces.`, e.status || 502);
      }
      const ticket = ticketCompra(compra, pago);
      void imprimirTicket(ticket).catch(e => console.error('Impresión de membresía:', e.message));
      res.status(201).json({ compraId: compra.idCompra, ticket });
    } catch (e) { responder(res, e, 'No se pudo registrar la compra. Puedes reintentar sin duplicarla.'); }
  });

  // ---------- Cobro de una membresía apartada desde la app (código PQ) ----------

  app.post('/api/membresias/apartadas/:id/cobrar', personal, async (req, res) => {
    const id = req.params.id;
    if (!/^[a-f\d]{24}$/i.test(id)) return res.status(400).json({ error: 'Compra inválida.' });
    const b = req.body || {};
    try {
      const aut = req.headers.authorization;
      const apartada = await admin(aut, `/membresias-compras/${id}`);
      const folio = folioDe(`apartada:${id}`);
      if (apartada.estado === 'activa') {
        // Reintento de un cobro que sí alcanzó a activarla: se devuelve el mismo ticket.
        if (apartada.folioPago === folio) return res.json({ compraId: id, ticket: ticketCompra(apartada, await pagoDeFolio(folio)) });
        throw fallo('Esta membresía ya fue pagada.');
      }
      if (apartada.estado === 'cancelada') throw fallo('Esta membresía apartada fue cancelada.');

      const pagoDatos = datosDePago(b, apartada.precio);
      const pago = await asegurarPago({
        folio, monto: apartada.precio, clienteRef: apartada.idCliente,
        clienteNombre: apartada.nombreCliente, pago: pagoDatos, usuario: nombreDe(req),
      });
      let activada;
      try {
        activada = await admin(aut, `/membresias-compras/${id}/activar`, {
          metodo: 'PATCH', cuerpo: { metodoPago: pago.metodo_pago, folioPago: pago.folio, fechaInicio: b.fechaInicio },
        });
      } catch (e) {
        throw fallo(`El cobro se registró con el folio ${pago.folio}, pero no se pudo activar la membresía (${e.message}). Reintenta el cobro: no se cobrará dos veces.`, e.status || 502);
      }
      const ticket = ticketCompra(activada, pago);
      void imprimirTicket(ticket).catch(e => console.error('Impresión de membresía:', e.message));
      res.status(201).json({ compraId: id, ticket });
    } catch (e) { responder(res, e, 'No se pudo cobrar la membresía. Puedes reintentar sin duplicar el cobro.'); }
  });
}

module.exports = { registrarRutas, ticketCompra, folioDe };
