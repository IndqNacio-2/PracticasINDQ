const crypto = require('node:crypto');

async function generarCodigoReserva(db, conPaquete = false, aleatorio = crypto.randomInt) {
  // El llamador mantiene una transacción: serializar asignaciones evita que
  // dos reservas concurrentes reciban el mismo código antes del INSERT.
  await db.query("SELECT pg_advisory_xact_lock(hashtext('webcobro-codigos-reserva'))");
  const prefijo = conPaquete ? 'PQ' : 'NU';
  const inicio = aleatorio(100000);
  const resultado = await db.query(`SELECT $1 || '-' || lpad(((n + $2) % 100000)::text, 5, '0') AS codigo
    FROM generate_series(0, 99999) AS n
    WHERE NOT EXISTS (SELECT 1 FROM webcobro.reservas r
      WHERE r.codigo = $1 || '-' || lpad(((n + $2) % 100000)::text, 5, '0'))
    ORDER BY n LIMIT 1`, [prefijo, inicio]);
  if (!resultado.rows[0]) throw new Error(`Se agotaron los códigos de reservación ${prefijo}.`);
  return resultado.rows[0].codigo;
}

function normalizarCodigoReserva(valor) {
  const limpio = String(valor ?? '').trim().toUpperCase();
  if (/^(NU|PQ)-\d{5}$/.test(limpio) || /^RSV-[A-Z0-9]{6}$/.test(limpio)) return limpio;
  // Conservar la captura histórica abreviada, sin adivinar NU frente a PQ.
  if (/^[A-Z0-9]{6}$/.test(limpio)) return `RSV-${limpio}`;
  return null;
}

module.exports = { normalizarCodigoReserva, generarCodigoReserva };