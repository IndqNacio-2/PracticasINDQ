// Adaptación del commit 948c1a5: turnos explícitos, sin tolerancias inventadas.
function clasificarAsistencia(ahora, turno) {
  if (!turno) return 'sin_turno';
  const minutos = (new Date(ahora) - new Date(turno.horaInicio)) / 60000;
  if (minutos >= turno.faltaMinutos) return 'inasistencia';
  return minutos >= turno.retardoMinutos ? 'retardo' : 'puntual';
}

function montarAsistencia(app, pool, opciones = {}) {
  const turnosHabilitados = opciones.turnosHabilitados === true;
  const normalizar = (valor) => {
    const codigo = String(valor ?? '').trim().toUpperCase();
    if (/^EMP-\d{3}$/.test(codigo) || /^CLI-\d+$/.test(codigo)) return codigo;
    return /^\d+$/.test(codigo) ? `CLI-${codigo}` : null;
  };
  const estadoSQL = turnosHabilitados ? 'estado' : 'NULL::text AS estado';
  // Una falta automática NO es una entrada física ni debe activar la salida.
  const marcasReales = turnosHabilitados ? 'AND NOT automatica' : '';
  const turnoHoy = async (db, codigo) => {
    if (!turnosHabilitados || !codigo.startsWith('EMP-')) return null;
    return (await db.query(`SELECT (CURRENT_DATE + hora_inicio)::timestamptz AS "horaInicio",
      retardo_minutos AS "retardoMinutos", falta_minutos AS "faltaMinutos"
      FROM webcobro.turnos WHERE codigo = $1 AND activo
      AND dia_semana = EXTRACT(DOW FROM CURRENT_DATE)::int
      ORDER BY hora_inicio, id LIMIT 1`, [codigo])).rows[0] || null;
  };
  const persona = async (db, codigo) => (await db.query(codigo.startsWith('EMP-')
    ? 'SELECT codigo, nombre, rol FROM webcobro.empleados WHERE codigo = $1'
    : 'SELECT id, nombre, membresia FROM webcobro.clientes WHERE id = $1',
  [codigo.startsWith('EMP-') ? codigo : codigo.slice(4)])).rows[0];
  const ultima = async (db, codigo, hoy = false) => (await db.query(`SELECT tipo, creado_en
    FROM webcobro.asistencias WHERE codigo = $1 ${marcasReales}
    ${hoy ? 'AND creado_en::date = CURRENT_DATE' : ''}
    ORDER BY creado_en DESC, id DESC LIMIT 1`, [codigo])).rows[0];
  const serializar = (r) => ({ _id: r.id, codigo: r.codigo, nombre: r.nombre,
    tipo: r.tipo, estado: r.estado ?? null, automatica: r.automatica === true,
    fecha: new Date(r.creado_en).toISOString(), ts: new Date(r.creado_en).getTime() });
  const ruta = (handler) => async (req, res) => {
    const codigo = normalizar(req.params?.identificador ?? req.params?.codigo ?? req.body?.codigo);
    if (!codigo) return res.status(400).json({ error: 'Formato inválido. Ejemplo: EMP-101 o CLI-3' });
    try { return await handler(req, res, codigo); }
    catch (error) {
      console.error('Error de asistencia:', error.message);
      return res.status(500).json({ error: 'No se pudo procesar la asistencia' });
    }
  };

  app.get('/api/asistencia/historial/:identificador', ruta(async (_req, res, codigo) => {
    const resultado = await pool.query(`SELECT id, codigo, nombre, tipo, creado_en, ${estadoSQL},
      ${turnosHabilitados ? 'automatica' : 'false AS automatica'}
      FROM webcobro.asistencias WHERE codigo = $1 ORDER BY creado_en DESC, id DESC LIMIT 10`, [codigo]);
    res.json(resultado.rows.map(serializar));
  }));
  app.get('/api/asistencia/empleado/:codigo', ruta(async (_req, res, codigo) => {
    const p = await persona(pool, codigo);
    if (!p) return res.status(404).json({ error: `Código ${codigo} no registrado` });
    const hoy = await ultima(pool, codigo, true);
    const ultimo = await ultima(pool, codigo);
    const turno = await turnoHoy(pool, codigo);
    res.json({ tipo: codigo.startsWith('EMP-') ? 'empleado' : 'cliente', codigo,
      nombre: p.nombre, rol: p.rol ?? null, membresia: p.membresia ?? null,
      marcoHoy: Boolean(hoy), ultimaMarcaHoy: hoy?.tipo ?? null,
      siguienteTipo: hoy?.tipo === 'entrada' ? 'salida' : 'entrada',
      ultimoRegistro: ultimo?.tipo ?? null, timestamp: ultimo ? new Date(ultimo.creado_en).toISOString() : null,
      horaInicio: turno ? new Date(turno.horaInicio).toISOString() : null });
  }));
  app.post('/api/asistencia/marcar', ruta(async (_req, res, codigo) => {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      // Serializa marcas y faltas del mismo código, incluso entre instancias.
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`asistencia:${codigo}`]);
      const p = await persona(db, codigo);
      if (!p) { await db.query('ROLLBACK'); return res.status(404).json({ error: `Código ${codigo} no registrado` }); }
      const reloj = (await db.query('SELECT CURRENT_TIMESTAMP AS ahora')).rows[0].ahora;
      const ultimo = await ultima(db, codigo);
      if (ultimo && new Date(reloj) - new Date(ultimo.creado_en) < 60000) {
        await db.query('ROLLBACK'); return res.status(429).json({ error: 'Espera 1 minuto entre marcas' });
      }
      const hoy = await ultima(db, codigo, true);
      const tipo = hoy?.tipo === 'entrada' ? 'salida' : 'entrada';
      const turno = tipo === 'entrada' ? await turnoHoy(db, codigo) : null;
      const estado = turnosHabilitados && tipo === 'entrada' && codigo.startsWith('EMP-')
        ? clasificarAsistencia(reloj, turno) : null;
      const resultado = turnosHabilitados
        ? await db.query(`INSERT INTO webcobro.asistencias (codigo, nombre, tipo, estado)
          VALUES ($1, $2, $3, $4) RETURNING *`, [codigo, p.nombre, tipo, estado])
        : await db.query(`INSERT INTO webcobro.asistencias (codigo, nombre, tipo)
          VALUES ($1, $2, $3) RETURNING *`, [codigo, p.nombre, tipo]);
      await db.query('COMMIT');
      res.json({ ...serializar(resultado.rows[0]), horaInicio: turno ? new Date(turno.horaInicio).toISOString() : null });
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }));

  // Solo revisa el primer turno diario, igual que el commit de origen.
  async function registrarInasistencias() {
    if (!turnosHabilitados) return;
    const candidatos = await pool.query(`SELECT DISTINCT ON (t.codigo) t.codigo, e.nombre,
      (CURRENT_DATE + t.hora_inicio)::timestamptz AS inicio, t.falta_minutos
      FROM webcobro.turnos t JOIN webcobro.empleados e ON e.codigo = t.codigo
      WHERE t.activo AND t.dia_semana = EXTRACT(DOW FROM CURRENT_DATE)::int
      ORDER BY t.codigo, t.hora_inicio, t.id`);
    for (const t of candidatos.rows) {
      const db = await pool.connect();
      try {
        await db.query('BEGIN');
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`asistencia:${t.codigo}`]);
        await db.query(`INSERT INTO webcobro.asistencias (codigo, nombre, tipo, estado, automatica)
          SELECT $1, $2, 'entrada', 'inasistencia', true
          WHERE CURRENT_TIMESTAMP >= $3::timestamptz + $4::integer * interval '1 minute'
          AND NOT EXISTS (SELECT 1 FROM webcobro.asistencias WHERE codigo = $1
            AND creado_en::date = CURRENT_DATE AND (tipo = 'entrada' OR automatica))`,
        [t.codigo, t.nombre, t.inicio, t.falta_minutos]);
        await db.query('COMMIT');
      } catch (error) { await db.query('ROLLBACK'); throw error; }
      finally { db.release(); }
    }
  }
  return { registrarInasistencias };
}

module.exports = { clasificarAsistencia, montarAsistencia };