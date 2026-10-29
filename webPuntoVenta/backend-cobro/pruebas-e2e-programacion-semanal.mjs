/*
 * Prueba la edicion segura de una regla semanal.
 * Crea una reserva temporal y comprueba que esa sesion no se mueva ni cambie,
 * mientras las sesiones libres de la misma plantilla si reciben el cambio.
 */
import { Client } from 'pg';

const BASE = process.env.BASE || 'http://localhost:3000';
const HOY = new Date().toISOString().slice(0, 10);
let reservaId = null;
let plantillaOriginal = null;

async function pedir(metodo, ruta, cuerpo) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }
  return { status: respuesta.status, datos };
}

function revisar(nombre, condicion, detalle = '') {
  if (!condicion) throw new Error(`${nombre} ${detalle}`);
  console.log(`  OK   ${nombre}`);
}

async function borrarReservaTemporal() {
  if (!reservaId) return;
  const cliente = new Client({
    host: process.env.PGHOST || process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.PGPORT || process.env.POSTGRES_PORT || 5432),
    database: process.env.PGDATABASE || process.env.POSTGRES_DB || 'punto_venta',
    user: process.env.PGUSER || process.env.POSTGRES_USER || 'admin',
    password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || 'PuntoVenta2026',
  });
  await cliente.connect();
  try {
    await cliente.query('DELETE FROM webcobro.reservas WHERE id = $1', [reservaId]);
  } finally {
    await cliente.end();
  }
  console.log('  (reservacion temporal eliminada)');
  reservaId = null;
}

async function restaurarPlantilla() {
  if (!plantillaOriginal) return;
  const restaurada = await pedir(
    'PATCH',
    `/admin/api/plantillas-horarios/${plantillaOriginal.idPlantilla}`,
    {
      idClase: plantillaOriginal.idClase,
      entrenadorId: plantillaOriginal.entrenadorId,
      horaInicio: plantillaOriginal.horaInicio,
      horaFin: plantillaOriginal.horaFin,
      capacidadTotal: plantillaOriginal.capacidadTotal,
      salon: plantillaOriginal.salon,
      estatus: plantillaOriginal.estatus,
      aplicarDesde: HOY,
    },
  );
  if (restaurada.status !== 200) {
    throw new Error(`No se pudo restaurar la plantilla: ${JSON.stringify(restaurada.datos)}`);
  }
  console.log('  (plantilla semanal restaurada)');
}

async function main() {
  console.log('\nPruebas de programacion semanal protegida');

  const plantillas = await pedir('GET', '/admin/api/plantillas-horarios');
  const plantilla = Array.isArray(plantillas.datos)
    ? plantillas.datos.find(item => item.nombreClase === 'Yoga' && item.estatus === 'activo')
    : null;
  revisar('encuentra una plantilla activa de Yoga', Boolean(plantilla));
  plantillaOriginal = { ...plantilla };

  const horarios = await pedir('GET', '/admin/api/horarios?estatus=activo');
  const sesionesPlantilla = Array.isArray(horarios.datos)
    ? horarios.datos.filter(item => item.idPlantilla === plantilla.idPlantilla && item.fecha >= HOY)
    : [];
  const reservas = await pedir('GET', '/cobro/api/reservas');
  const ocupadas = new Set(
    (Array.isArray(reservas.datos) ? reservas.datos : [])
      .filter(item => item.status !== 'cancelado')
      .map(item => `${item.class}|${item.fecha}|${item.time}`),
  );
  const sesionProtegida = sesionesPlantilla.find(item => (
    !ocupadas.has(`${item.nombreClase}|${item.fecha}|${item.horaInicio}`)
  ));
  revisar('encuentra una sesion futura libre para la prueba', Boolean(sesionProtegida));

  const nuevaReserva = await pedir('POST', '/cobro/api/reservas', {
    client: 'Visitante E2E Semana',
    type: 'visitante',
    class: sesionProtegida.nombreClase,
    time: sesionProtegida.horaInicio,
    fecha: sesionProtegida.fecha,
  });
  revisar('crea la reservacion que protegera la sesion (201)', nuevaReserva.status === 201, `-> ${nuevaReserva.status} ${JSON.stringify(nuevaReserva.datos)}`);
  reservaId = nuevaReserva.datos?.reservacion?.id;

  const capacidadTemporal = Math.max(1, Number(plantilla.capacidadTotal) - 1);
  const cambio = await pedir('PATCH', `/admin/api/plantillas-horarios/${plantilla.idPlantilla}`, {
    capacidadTotal: capacidadTemporal,
    aplicarDesde: HOY,
  });
  revisar('edita la regla semanal (200)', cambio.status === 200, `-> ${cambio.status} ${JSON.stringify(cambio.datos)}`);
  revisar('reporta una sesion protegida', cambio.datos?.sesionesProtegidas === 1, `-> ${cambio.datos?.sesionesProtegidas}`);
  revisar('actualiza por lo menos una sesion libre', cambio.datos?.sesionesActualizadas > 0, `-> ${cambio.datos?.sesionesActualizadas}`);

  const horariosDespues = await pedir('GET', `/admin/api/horarios?fecha=${sesionProtegida.fecha}`);
  const protegidaDespues = Array.isArray(horariosDespues.datos)
    ? horariosDespues.datos.find(item => item.idHorario === sesionProtegida.idHorario)
    : null;
  revisar('la sesion reservada conserva su capacidad original', protegidaDespues?.capacidadTotal === sesionProtegida.capacidadTotal, `-> ${protegidaDespues?.capacidadTotal}`);
  revisar('la sesion reservada conserva su hora original', protegidaDespues?.horaInicio === sesionProtegida.horaInicio, `-> ${protegidaDespues?.horaInicio}`);

  await borrarReservaTemporal();
  await restaurarPlantilla();
  plantillaOriginal = null;

  console.log('\n8/8 pruebas correctas.');
}

main().catch(async error => {
  console.error('La prueba se rompio:', error);
  try {
    await borrarReservaTemporal();
    await restaurarPlantilla();
  } catch (limpiezaError) {
    console.error('Tambien fallo la limpieza:', limpiezaError);
  }
  process.exitCode = 1;
});