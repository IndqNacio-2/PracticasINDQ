/*
 * Prueba la edicion y cierre seguro de una serie semanal. Crea datos aislados,
 * protege una sesion con reserva activa y comprueba que una reserva cancelada
 * no impida reemplazar su sesion.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import pg from '../backend-cobro/node_modules/pg/lib/index.js';

const { Client } = pg;
const BASE = process.env.BASE || 'http://localhost:3000';
const MS_DIA = 24 * 60 * 60 * 1000;
let serieId = '';
const reservasId = [];

async function pedir(metodo, ruta, cuerpo) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  let datos = null;
  try { datos = await respuesta.json(); } catch { datos = null; }
  return { status: respuesta.status, datos };
}

function revisar(nombre, condicion, detalle = '') {
  if (!condicion) throw new Error(`${nombre} ${detalle}`);
  console.log(`  OK   ${nombre}`);
}

function fechaISO(fecha) { return fecha.toISOString().slice(0, 10); }
function sumarDias(fecha, dias) {
  return fechaISO(new Date(new Date(`${fecha}T00:00:00.000Z`).getTime() + dias * MS_DIA));
}

async function limpiar() {
  if (reservasId.length) {
    const cliente = new Client({
      host: process.env.PG_HOST || '127.0.0.1',
      port: Number(process.env.PG_PORT || 5432),
      database: process.env.PG_DB || 'punto_venta',
      user: process.env.PG_USER || 'admin',
      password: process.env.PG_PASSWORD || 'PuntoVenta2026',
    });
    await cliente.connect();
    try {
      await cliente.query('DELETE FROM webcobro.reservas WHERE id = ANY($1::int[])', [reservasId]);
    } finally {
      await cliente.end();
    }
    console.log(`  (${reservasId.length} reservaciones temporales eliminadas)`);
    reservasId.length = 0;
  }
  if (!serieId || !process.env.MONGO_URI) return;
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const db = mongoose.connection.db;
    const plantillas = await db.collection('webadministrativa_plantillas_horarios')
      .find({ serieId }).project({ _id: 1 }).toArray();
    const ids = plantillas.map(item => item._id.toString());
    const sesiones = await db.collection('webadministrativa_horarios').deleteMany({ idPlantilla: { $in: ids } });
    const reglas = await db.collection('webadministrativa_plantillas_horarios').deleteMany({ serieId });
    console.log(`  (${reglas.deletedCount} plantillas y ${sesiones.deletedCount} sesiones temporales eliminadas)`);
  } finally {
    await mongoose.disconnect();
  }
  serieId = '';
}

async function obtenerEntrenadorActivo() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const entrenador = await mongoose.connection.db.collection('webadministrativa_usuarios')
      .findOne({ rol: 'entrenador', estatus: 'activo' }, { projection: { _id: 1 } });
    return entrenador?._id.toString() || '';
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  console.log('\nPruebas de edicion de serie semanal');
  revisar('tiene MONGO_URI para preparar y limpiar la prueba', Boolean(process.env.MONGO_URI));
  const clases = await pedir('GET', '/admin/api/clases');
  const clase = Array.isArray(clases.datos) ? clases.datos.find(item => item.estatus === 'activo') : null;
  const entrenadorId = await obtenerEntrenadorActivo();
  revisar('encuentra una clase activa', Boolean(clase));
  revisar('encuentra un instructor activo', Boolean(entrenadorId));

  const hoy = fechaISO(new Date());
  const fechaInicio = sumarDias(hoy, 2);
  const aplicarDesde = sumarDias(fechaInicio, 7);
  const fechaFin = sumarDias(fechaInicio, 34);
  const diasOriginales = [0, 2, 4];
  const diasNuevos = [1, 3, 6];
  const sala = `Sala E2E Edicion ${Date.now()}`;

  const creada = await pedir('POST', '/admin/api/plantillas-horarios', {
    idClase: clase.idClase,
    entrenadorId,
    salon: sala,
    fechaInicio,
    horaInicio: '20:00',
    horaFin: '21:00',
    diasSemana: diasOriginales,
    fechaFin,
    visibleReservas: true,
    listaEsperaHabilitada: false,
    estatus: 'activo',
  });
  revisar('crea la serie temporal (201)', creada.status === 201, `-> ${creada.status} ${JSON.stringify(creada.datos)}`);
  serieId = creada.datos.serieId;

  const horariosIniciales = await pedir('GET', '/admin/api/horarios?estatus=activo');
  const idsOriginales = new Set(creada.datos.plantillas.map(item => item.idPlantilla));
  const futuras = horariosIniciales.datos
    .filter(item => idsOriginales.has(item.idPlantilla) && item.fecha >= aplicarDesde)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  revisar('encuentra dos sesiones futuras para proteger y cancelar', futuras.length >= 2);
  const protegida = futuras[0];
  const cancelada = futuras[1];

  const reservaActiva = await pedir('POST', '/cobro/api/reservas', {
    client: `Visitante Activo ${Date.now()}`,
    type: 'visitante', class: protegida.nombreClase, time: protegida.horaInicio, fecha: protegida.fecha,
  });
  revisar('crea la reserva activa (201)', reservaActiva.status === 201, `-> ${reservaActiva.status} ${JSON.stringify(reservaActiva.datos)}`);
  reservasId.push(reservaActiva.datos.reservacion.id);

  const reservaCancelada = await pedir('POST', '/cobro/api/reservas', {
    client: `Visitante Cancelado ${Date.now()}`,
    type: 'visitante', class: cancelada.nombreClase, time: cancelada.horaInicio, fecha: cancelada.fecha,
  });
  revisar('crea la reserva que se cancelara (201)', reservaCancelada.status === 201, `-> ${reservaCancelada.status} ${JSON.stringify(reservaCancelada.datos)}`);
  reservasId.push(reservaCancelada.datos.reservacion.id);
  const cancelacion = await pedir('PATCH', `/cobro/api/reservas/${reservaCancelada.datos.reservacion.id}`, { status: 'cancelado' });
  revisar('cancela la segunda reserva (200)', cancelacion.status === 200);

  const edicion = await pedir('PATCH', `/admin/api/plantillas-horarios/series/${serieId}`, {
    idClase: clase.idClase,
    entrenadorId,
    salon: sala,
    horaInicio: '21:00',
    horaFin: '22:00',
    diasSemana: diasNuevos,
    aplicarDesde,
    visibleReservas: false,
    listaEsperaHabilitada: true,
  });
  revisar('edita toda la serie (200)', edicion.status === 200, `-> ${edicion.status} ${JSON.stringify(edicion.datos)}`);
  revisar('reporta exactamente una sesion protegida', edicion.datos.sesionesProtegidas === 1, `-> ${edicion.datos.sesionesProtegidas}`);
  revisar('crea una plantilla por cada dia nuevo', edicion.datos.plantillas.length === diasNuevos.length);
  revisar('conserva el mismo identificador de serie', edicion.datos.serieId === serieId);

  const horariosEditados = await pedir('GET', '/admin/api/horarios');
  const protegidaDespues = horariosEditados.datos.find(item => item.idHorario === protegida.idHorario);
  revisar('la sesion con reserva activa conserva su hora', protegidaDespues?.horaInicio === protegida.horaInicio);
  revisar('la sesion con reserva activa conserva su plantilla', protegidaDespues?.idPlantilla === protegida.idPlantilla);
  const canceladaDespues = horariosEditados.datos.find(item => item.idHorario === cancelada.idHorario);
  revisar('la reserva cancelada no protege la sesion anterior', !canceladaDespues);

  const idsNuevos = new Set(edicion.datos.plantillas.map(item => item.idPlantilla));
  const sesionesNuevas = horariosEditados.datos.filter(item => idsNuevos.has(item.idPlantilla));
  revisar('genera sesiones para la version nueva', sesionesNuevas.length > 0);
  revisar('las nuevas sesiones usan solo los dias seleccionados', sesionesNuevas.every(item => diasNuevos.includes(new Date(`${item.fecha}T00:00:00.000Z`).getUTCDay())));
  revisar('las nuevas sesiones usan el horario editado', sesionesNuevas.every(item => item.horaInicio === '21:00' && item.horaFin === '22:00'));
  revisar('propaga reservaciones y lista de espera', sesionesNuevas.every(item => item.visibleReservas === false && item.listaEsperaHabilitada === true));

  const desactivarDesde = sumarDias(aplicarDesde, 7);
  const desactivada = await pedir('POST', `/admin/api/plantillas-horarios/series/${serieId}/desactivar`, { aplicarDesde: desactivarDesde });
  revisar('desactiva la programacion futura (200)', desactivada.status === 200, `-> ${desactivada.status} ${JSON.stringify(desactivada.datos)}`);
  revisar('desactiva sesiones libres', desactivada.datos.sesionesDesactivadas > 0);

  const eliminada = await pedir('DELETE', `/admin/api/plantillas-horarios/series/${serieId}/futuro`, { aplicarDesde: desactivarDesde });
  revisar('elimina la programacion futura inactiva (200)', eliminada.status === 200, `-> ${eliminada.status} ${JSON.stringify(eliminada.datos)}`);
  revisar('elimina sesiones futuras libres', eliminada.datos.sesionesEliminadas > 0);

  await limpiar();
  console.log('\n23/23 pruebas correctas.');
}

main().catch(async error => {
  console.error('La prueba se rompio:', error);
  try { await limpiar(); } catch (limpiezaError) { console.error('Tambien fallo la limpieza:', limpiezaError); }
  process.exitCode = 1;
});