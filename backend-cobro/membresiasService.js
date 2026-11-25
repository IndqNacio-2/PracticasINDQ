// No abre conexiones: todas las escrituras usan la transacción del llamador.
const crypto = require('node:crypto');
const { imprimirTicket } = require('./ticketService');

function fallo(message, status = 409) { return Object.assign(new Error(message), { status }); }
function fechaLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function finVigencia(inicio, opcion) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) throw fallo('Fecha de inicio inválida.', 400);
  const [y, m, d] = inicio.split('-').map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  if (fecha.toISOString().slice(0, 10) !== inicio) throw fallo('Fecha de inicio inválida.', 400);
  const meses = opcion.unidadDuracion === 'meses';
  const duracion = Number(opcion.duracion ?? opcion.vigenciaDias);
  if (!Number.isSafeInteger(duracion) || duracion < 1 || duracion > 36500) throw fallo('La opción no tiene una vigencia válida.');
  if (meses) {
    fecha.setUTCDate(1);
    fecha.setUTCMonth(fecha.getUTCMonth() + duracion);
    const ultimo = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0)).getUTCDate();
    fecha.setUTCDate(Math.min(d, ultimo));
  } else fecha.setUTCDate(fecha.getUTCDate() + duracion);
  // Intervalo inclusivo: una compra de un día vence el día de inicio.
  fecha.setUTCDate(fecha.getUTCDate() - 1);
  return fecha.toISOString().slice(0, 10);
}
function condicionesDe(membresia, opcionId) {
  const opcion = membresia?.opciones?.find(o => o.id === opcionId);
  if (membresia?.estatus !== 'activo' || !opcion) throw fallo('La membresía u opción ya no está disponible.');
  if (!Array.isArray(membresia.clasesIds) || !membresia.clasesIds.length) throw fallo('Vincula esta membresía con clases del catálogo antes de venderla.');
  if (opcion.costo === null || !Number.isFinite(Number(opcion.costo)) || Number(opcion.costo) < 0 || Number(opcion.costo) > 99999999.99) throw fallo('Define un precio válido de hasta $99,999,999.99 antes de venderla.');
  if (opcion.entradas !== null && (!Number.isSafeInteger(opcion.entradas) || opcion.entradas < 1)) throw fallo('Cantidad de entradas inválida.');
  if (opcion.distribucion === 'por_clase' && membresia.clasesIds.some(id => !Number.isSafeInteger(opcion.entradasPorClase?.[id]) || opcion.entradasPorClase[id] < 1)) throw fallo('Faltan las entradas por clase.');
  return { nombre: membresia.nombre, clasesIds: membresia.clasesIds, opcion: { ...opcion }, complementos: membresia.complementos, kit: membresia.kit };
}

// El historial de reservas es el libro de movimientos: cancelada devuelve saldo;
// asistida/inasistencia consume; pendiente/pagada aparta. No hay contador duplicado.
const USOS = `SELECT clase_id, estado, estado_cupo FROM webcobro.reservas
  WHERE membresia_compra_id = $1 AND estado <> 'cancelado'`;
async function saldo(db, compra, claseId) {
  const usos = (await db.query(USOS, [compra.id])).rows;
  const opcion = compra.condiciones.opcion;
  const relevantes = opcion.distribucion === 'por_clase' ? usos.filter(u => u.clase_id === claseId) : usos;
  const limite = opcion.distribucion === 'por_clase' ? opcion.entradasPorClase[claseId] : opcion.entradas;
  const consumidas = relevantes.filter(u => ['asistido', 'no_asistio'].includes(u.estado)).length;
  const apartadas = relevantes.length - consumidas;
  return { total: limite, consumidas, apartadas, disponibles: limite === null ? null : Math.max(0, limite - relevantes.length) };
}
async function buscarCobertura(db, clienteId, claseId, fecha) {
  // Bloqueo estable por compra impide gastar la última entrada dos veces.
  const compras = (await db.query(`SELECT *, to_char(fecha_inicio, 'YYYY-MM-DD') AS inicio,
      to_char(fecha_fin, 'YYYY-MM-DD') AS fin FROM webcobro.membresias_compras
      WHERE cliente_id = $1 AND fecha_inicio <= $2::date AND fecha_fin >= $2::date
      ORDER BY fecha_fin, id FOR UPDATE`, [clienteId, fecha])).rows;
  for (const compra of compras) {
    if (!compra.condiciones.clasesIds.includes(claseId)) continue;
    const balance = await saldo(db, compra, claseId);
    if (balance.disponibles === null || balance.disponibles > 0) return compra;
  }
  return null;
}
async function validarReagenda(db, reserva, fecha, claseId) {
  if (!reserva.membresiaCompraId) return;
  const compra = (await db.query(`SELECT condiciones, to_char(fecha_inicio, 'YYYY-MM-DD') AS inicio,
    to_char(fecha_fin, 'YYYY-MM-DD') AS fin FROM webcobro.membresias_compras WHERE id = $1`, [reserva.membresiaCompraId])).rows[0];
  if (!compra || fecha < compra.inicio || fecha > compra.fin || !compra.condiciones.clasesIds.includes(claseId)) {
    throw fallo('El nuevo horario no está cubierto por la vigencia y clases de la membresía comprada.');
  }
}
function ticketCompra(compra, pago, cliente) {
  return { contexto: 'membresia', folio: pago.folio, fecha: new Date(pago.creado_en).toISOString(), cliente,
    usuario: pago.usuario, metodoPago: pago.metodo_pago, total: Number(pago.monto),
    efectivoRecibido: pago.efectivo_recibido == null ? null : Number(pago.efectivo_recibido),
    cambio: pago.cambio == null ? null : Number(pago.cambio), referencia: pago.referencia,
    membresia: compra.condiciones.nombre, fechaInicio: compra.inicio, fechaFin: compra.fin,
    items: [{ descripcion: `Membresía ${compra.condiciones.nombre}`, cantidad: 1, precioUnitario: Number(pago.monto), importe: Number(pago.monto) }] };
}
function registrarRutas(app, pool, adminApi) {
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
  app.get('/api/membresias/catalogo', personal, async (req, res) => {
    try {
      const respuesta = await fetch(`${adminApi}/membresias?estatus=activo`, { headers: { Authorization: req.headers.authorization }, signal: AbortSignal.timeout(8000) });
      if (!respuesta.ok) throw fallo('No se pudo consultar el catálogo.', 503);
      const catalogo = await respuesta.json();
      res.json(catalogo.filter(m => m.clasesIds?.length));
    } catch (e) { res.status(e.status || 503).json({ error: e.message }); }
  });
  app.get('/api/clientes/:id/membresias', personal, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Cliente inválido.' });
    try {
      const compras = (await pool.query(`SELECT c.*, to_char(c.fecha_inicio, 'YYYY-MM-DD') AS inicio,
        to_char(c.fecha_fin, 'YYYY-MM-DD') AS fin, p.folio FROM webcobro.membresias_compras c
        JOIN webcobro.pagos p ON p.id = c.pago_id WHERE c.cliente_id = $1 ORDER BY c.id DESC`, [id])).rows;
      res.json(await Promise.all(compras.map(async c => ({ id: c.id, nombre: c.condiciones.nombre,
        clasesIds: c.condiciones.clasesIds,
        fechaInicio: c.inicio, fechaFin: c.fin, folio: c.folio,
        vigente: c.inicio <= fechaLocal() && c.fin >= fechaLocal(),
        saldos: await Promise.all((c.condiciones.opcion.distribucion === 'por_clase' ? c.condiciones.clasesIds : [null])
          .map(async claseId => ({ claseId, ...await saldo(pool, c, claseId) }))) }))));
    } catch (e) { console.error(e); res.status(500).json({ error: 'No se pudo consultar el saldo.' }); }
  });
  app.get('/api/membresias/compras/:id/ticket', personal, async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Compra inválida.' });
    try {
      const c = (await pool.query(`SELECT c.*, to_char(c.fecha_inicio, 'YYYY-MM-DD') AS inicio,
        to_char(c.fecha_fin, 'YYYY-MM-DD') AS fin, cl.nombre AS cliente FROM webcobro.membresias_compras c
        JOIN webcobro.clientes cl ON cl.id = c.cliente_id WHERE c.id = $1`, [req.params.id])).rows[0];
      if (!c) return res.status(404).json({ error: 'Compra no encontrada.' });
      const p = (await pool.query('SELECT * FROM webcobro.pagos WHERE id = $1', [c.pago_id])).rows[0];
      res.json(ticketCompra(c, p, p.cliente_nombre || c.cliente));
    } catch { res.status(500).json({ error: 'No se pudo recuperar el ticket.' }); }
  });
  app.post('/api/membresias/compras', personal, async (req, res) => {
    const b = req.body || {};
    if (!Number.isSafeInteger(b.clienteId) || b.clienteId < 1 || !/^[a-f\d]{24}$/.test(b.membresiaId || '')
      || typeof b.opcionId !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(b.solicitudId || '')) return res.status(400).json({ error: 'Selecciona cliente, membresía y opción válidos.' });
    if (!['efectivo', 'tarjeta', 'transferencia'].includes(b.metodoPago)) return res.status(400).json({ error: 'Método de pago inválido.' });
    let db;
    try {
      db = await pool.connect();
      await db.query('BEGIN');
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`webcobro-compra-${b.solicitudId}`]);
      const anterior = (await db.query(`SELECT *, to_char(fecha_inicio, 'YYYY-MM-DD') AS inicio,
        to_char(fecha_fin, 'YYYY-MM-DD') AS fin FROM webcobro.membresias_compras WHERE solicitud_id = $1`, [b.solicitudId])).rows[0];
      const cliente = (await db.query('SELECT id, nombre, activo FROM webcobro.clientes WHERE id = $1 FOR SHARE', [b.clienteId])).rows[0];
      if (!cliente || !cliente.activo) throw fallo('El cliente no existe o está inactivo.');
      if (anterior) {
        if (anterior.cliente_id !== b.clienteId || anterior.catalogo_id !== b.membresiaId || anterior.opcion_id !== b.opcionId) throw fallo('Esta solicitud ya fue utilizada para otra compra.');
        const pago = (await db.query('SELECT * FROM webcobro.pagos WHERE id = $1', [anterior.pago_id])).rows[0];
        await db.query('COMMIT');
        return res.json({ compraId: anterior.id, ticket: ticketCompra(anterior, pago, pago.cliente_nombre || cliente.nombre) });
      }
      const respuesta = await fetch(`${adminApi}/membresias/${b.membresiaId}`, { headers: { Authorization: req.headers.authorization }, signal: AbortSignal.timeout(8000) });
      if (!respuesta.ok) throw fallo('No se pudo validar la membresía del catálogo.', 503);
      const condiciones = condicionesDe(await respuesta.json(), b.opcionId);
      const inicio = b.fechaInicio || fechaLocal();
      const fin = finVigencia(inicio, condiciones.opcion);
      if (inicio < fechaLocal()) throw fallo('La compra no puede comenzar en el pasado.', 400);
      const monto = Number(condiciones.opcion.costo);
      const recibido = b.efectivoRecibido;
      if (b.metodoPago === 'efectivo' && (typeof recibido !== 'number' || !Number.isFinite(recibido) || recibido < monto)) throw fallo('El efectivo recibido no cubre el total.', 400);
      const pago = (await db.query(`INSERT INTO webcobro.pagos
        (cliente_id, cliente_nombre, monto, metodo_pago, efectivo_recibido, cambio, referencia, folio, usuario)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [cliente.id, cliente.nombre, monto, b.metodoPago,
        b.metodoPago === 'efectivo' ? recibido : null, b.metodoPago === 'efectivo' ? Math.round((recibido - monto) * 100) / 100 : null,
        b.metodoPago === 'transferencia' ? String(b.referencia || '').slice(0, 200) : null,
        `MEM-${crypto.randomBytes(8).toString('hex').toUpperCase()}`, `${req.personalMembresias.nombre} ${req.personalMembresias.apellidos || ''}`.trim()])).rows[0];
      const compra = (await db.query(`INSERT INTO webcobro.membresias_compras
        (solicitud_id, cliente_id, catalogo_id, opcion_id, condiciones, fecha_inicio, fecha_fin, pago_id)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8) RETURNING *,
        to_char(fecha_inicio, 'YYYY-MM-DD') AS inicio, to_char(fecha_fin, 'YYYY-MM-DD') AS fin`,
      [b.solicitudId, cliente.id, b.membresiaId, b.opcionId, JSON.stringify(condiciones), inicio, fin, pago.id])).rows[0];
      await db.query('COMMIT');
      const ticket = ticketCompra(compra, pago, cliente.nombre);
      void imprimirTicket(ticket).catch(e => console.error('Impresión de membresía:', e.message));
      res.status(201).json({ compraId: compra.id, ticket });
    } catch (e) {
      if (db) await db.query('ROLLBACK');
      console.error('Venta de membresía:', e);
      res.status(e.status || 500).json({ error: e.status ? e.message : 'No se pudo registrar la compra. Puedes reintentar sin duplicarla.' });
    } finally { db?.release(); }
  });
}
module.exports = { registrarRutas, buscarCobertura, validarReagenda, saldo, finVigencia, condicionesDe, ticketCompra };