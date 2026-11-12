/*
 * Prueba que una sola ocurrencia pueda separarse de su plantilla y que ni el
 * generador ni una edicion posterior de la serie vuelvan a sobrescribirla.
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const BASE = process.env.BASE || 'http://localhost:3000';
const MS_DIA = 24 * 60 * 60 * 1000;
let serieId = '';

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
  console.log('\nPruebas de excepcion de una sesion');
  revisar('tiene MONGO_URI para preparar y limpiar la prueba', Boolean(process.env.MONGO_URI));
  const clases = await pedir('GET', '/admin/api/clases');
  const clase = Array.isArray(clases.datos) ? clases.datos.find(item => item.estatus === 'activo') : null;
  const entrenadorId = await obtenerEntrenadorActivo();
  revisar('encuentra una clase activa', Boolean(clase));
  revisar('encuentra un instructor activo', Boolean(entrenadorId));

  const hoy = fechaISO(new Date());
  const fechaInicio = sumarDias(hoy, 2);
  const fechaFin = sumarDias(fechaInicio, 27);
  const diaSemana = new Date(`${fechaInicio}T00:00:00.000Z`).getUTCDay();
  const salaOriginal = `Sala E2E Excepcion ${Date.now()}`;
  const salaExcepcion = `${salaOriginal} Especial`;

  const creada = await pedir('POST', '/admin/api/plantillas-horarios', {
    idClase: clase.idClase,
    entrenadorId,
    salon: salaOriginal,
    fechaInicio,
    horaInicio: '18:00',
    horaFin: '19:00',
    diasSemana: [diaSemana],
    fechaFin,
    visibleReservas: true,
    listaEsperaHabilitada: false,
    estatus: 'activo',
  });
  revisar('crea la serie temporal (201)', creada.status === 201, `-> ${creada.status} ${JSON.stringify(creada.datos)}`);
  serieId = creada.datos.serieId;
  const plantillaOriginal = creada.datos.plantillas[0];

  const horarios = await pedir('GET', '/admin/api/horarios');
  const sesionesOriginales = horarios.datos
    .filter(item => item.idPlantilla === plantillaOriginal.idPlantilla)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  revisar('genera varias ocurrencias de la plantilla', sesionesOriginales.length >= 3);
  const objetivo = sesionesOriginales[1];

  const campoProhibido = await pedir('PATCH', `/admin/api/horarios/${objetivo.idHorario}/excepcion`, {
    fecha: sumarDias(objetivo.fecha, 1),
  });
  revisar('rechaza cambiar la fecha de una excepcion (400)', campoProhibido.status === 400);

  const editada = await pedir('PATCH', `/admin/api/horarios/${objetivo.idHorario}/excepcion`, {
    entrenadorId,
    salon: salaExcepcion,
    horaInicio: '19:00',
    horaFin: '20:00',
    estatus: 'activo',
    visibleReservas: false,
  });
  revisar('edita solo la ocurrencia (200)', editada.status === 200, `-> ${editada.status} ${JSON.stringify(editada.datos)}`);
  revisar('marca la ocurrencia como excepcion', editada.datos.horario.esExcepcionPlantilla === true);
  revisar('conserva la plantilla y la llave de generacion', editada.datos.horario.idPlantilla === objetivo.idPlantilla && editada.datos.horario.claveGeneracion === objetivo.claveGeneracion);
  revisar('aplica sala, horario y visibilidad', editada.datos.horario.salon === salaExcepcion && editada.datos.horario.horaInicio === '19:00' && editada.datos.horario.visibleReservas === false);

  const generada = await pedir('POST', '/admin/api/plantillas-horarios/generar', { desde: fechaInicio, dias: 28 });
  revisar('vuelve a ejecutar el generador (200)', generada.status === 200);
  revisar('el generador reconoce sesiones existentes', generada.datos.sesionesExistentes >= sesionesOriginales.length);

  const trasGenerar = await pedir('GET', `/admin/api/horarios?fecha=${objetivo.fecha}`);
  const mismaExcepcion = trasGenerar.datos.find(item => item.idHorario === objetivo.idHorario);
  revisar('el generador no sobrescribe la excepcion', mismaExcepcion?.horaInicio === '19:00' && mismaExcepcion?.salon === salaExcepcion && mismaExcepcion?.esExcepcionPlantilla === true);
  revisar('el generador no duplica la ocurrencia', trasGenerar.datos.filter(item => item.claveGeneracion === objetivo.claveGeneracion).length === 1);

  const cambioSerie = await pedir('PATCH', `/admin/api/plantillas-horarios/series/${serieId}`, {
    idClase: clase.idClase,
    entrenadorId,
    salon: salaOriginal,
    horaInicio: '20:00',
    horaFin: '21:00',
    diasSemana: [diaSemana],
    aplicarDesde: objetivo.fecha,
    visibleReservas: true,
    listaEsperaHabilitada: true,
  });
  revisar('edita la serie desde la fecha de la excepcion (200)', cambioSerie.status === 200, `-> ${cambioSerie.status} ${JSON.stringify(cambioSerie.datos)}`);
  revisar('la edicion de serie reporta la excepcion protegida', cambioSerie.datos.sesionesProtegidas === 1, `-> ${cambioSerie.datos.sesionesProtegidas}`);

  const horariosFinales = await pedir('GET', '/admin/api/horarios');
  const excepcionFinal = horariosFinales.datos.find(item => item.idHorario === objetivo.idHorario);
  revisar('la excepcion sobrevive al cambio de serie', excepcionFinal?.horaInicio === '19:00' && excepcionFinal?.salon === salaExcepcion && excepcionFinal?.esExcepcionPlantilla === true);
  const idsNuevos = new Set(cambioSerie.datos.plantillas.map(item => item.idPlantilla));
  const nuevas = horariosFinales.datos.filter(item => idsNuevos.has(item.idPlantilla));
  revisar('las demas fechas reciben el horario nuevo', nuevas.length > 0 && nuevas.every(item => item.horaInicio === '20:00'));

  await limpiar();
  console.log('\n18/18 pruebas correctas.');
}

main().catch(async error => {
  console.error('La prueba se rompio:', error);
  try { await limpiar(); } catch (limpiezaError) { console.error('Tambien fallo la limpieza:', limpiezaError); }
  process.exitCode = 1;
});