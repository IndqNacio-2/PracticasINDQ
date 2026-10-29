/*
 * Prueba la creacion de una serie semanal desde cero. Usa una sala temporal y
 * elimina de MongoDB todas las plantillas y sesiones creadas al finalizar.
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

function fechaISO(fecha) {
  return fecha.toISOString().slice(0, 10);
}

function sumarDias(fecha, dias) {
  return fechaISO(new Date(new Date(`${fecha}T00:00:00.000Z`).getTime() + dias * MS_DIA));
}

function contarOcurrencias(desde, hasta, diasSemana) {
  const permitidos = new Set(diasSemana);
  let total = 0;
  for (
    let cursor = new Date(`${desde}T00:00:00.000Z`);
    cursor <= new Date(`${hasta}T00:00:00.000Z`);
    cursor = new Date(cursor.getTime() + MS_DIA)
  ) {
    if (permitidos.has(cursor.getUTCDay())) total += 1;
  }
  return total;
}

async function limpiar() {
  if (!serieId || !process.env.MONGO_URI) return;
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const db = mongoose.connection.db;
    const plantillas = await db.collection('webadministrativa_plantillas_horarios')
      .find({ serieId })
      .project({ _id: 1 })
      .toArray();
    const ids = plantillas.map(item => item._id.toString());
    const sesiones = await db.collection('webadministrativa_horarios')
      .deleteMany({ idPlantilla: { $in: ids } });
    const reglas = await db.collection('webadministrativa_plantillas_horarios')
      .deleteMany({ serieId });
    console.log(`  (${reglas.deletedCount} plantillas y ${sesiones.deletedCount} sesiones temporales eliminadas)`);
  } finally {
    await mongoose.disconnect();
  }
  serieId = '';
}

async function obtenerEntrenadorActivo() {
  if (!process.env.MONGO_URI) throw new Error('Falta MONGO_URI para preparar la prueba.');
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const entrenador = await mongoose.connection.db
      .collection('webadministrativa_usuarios')
      .findOne({ rol: 'entrenador', estatus: 'activo' }, { projection: { _id: 1 } });
    return entrenador ? { idUsuario: entrenador._id.toString() } : null;
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  console.log('\nPruebas de creacion de programacion semanal');

  const clases = await pedir('GET', '/admin/api/clases');
  const entrenador = await obtenerEntrenadorActivo();
  const clase = Array.isArray(clases.datos)
    ? clases.datos.find(item => item.estatus === 'activo')
    : null;
  revisar('encuentra una clase activa', Boolean(clase));
  revisar('encuentra un instructor activo', Boolean(entrenador));

  const hoy = new Date();
  const fechaInicio = fechaISO(new Date(Date.UTC(
    hoy.getUTCFullYear(),
    hoy.getUTCMonth(),
    hoy.getUTCDate() + 2,
  )));
  const fechaHasta = sumarDias(fechaInicio, 55);
  const diasSemana = [0, 2, 4];
  const sala = `Sala E2E Serie ${Date.now()}`;
  const cuerpo = {
    idClase: clase.idClase,
    entrenadorId: entrenador.idUsuario,
    salon: sala,
    fechaInicio,
    horaInicio: '22:00',
    horaFin: '23:00',
    diasSemana,
    fechaFin: '',
    visibleReservas: false,
    listaEsperaHabilitada: true,
    estatus: 'activo',
  };

  const capacidadManipulada = await pedir('POST', '/admin/api/plantillas-horarios', {
    ...cuerpo,
    capacidadTotal: 999,
  });
  revisar('rechaza capacidad enviada por el navegador (400)', capacidadManipulada.status === 400);

  const diasDuplicados = await pedir('POST', '/admin/api/plantillas-horarios', {
    ...cuerpo,
    diasSemana: [2, 2],
  });
  revisar('rechaza dias repetidos (400)', diasDuplicados.status === 400);

  const rangoExcesivo = await pedir('POST', '/admin/api/plantillas-horarios', {
    ...cuerpo,
    fechaFin: sumarDias(fechaInicio, 366),
  });
  revisar('rechaza rangos mayores de 366 dias (400)', rangoExcesivo.status === 400);

  const creada = await pedir('POST', '/admin/api/plantillas-horarios', cuerpo);
  revisar('crea la programacion semanal (201)', creada.status === 201, `-> ${creada.status} ${JSON.stringify(creada.datos)}`);
  serieId = creada.datos?.serieId || '';
  revisar('devuelve un identificador de serie', Boolean(serieId));
  revisar('crea una plantilla por cada dia elegido', creada.datos?.plantillas?.length === 3);
  revisar('todas las plantillas comparten la serie', creada.datos.plantillas.every(item => item.serieId === serieId));
  revisar('ordena y conserva los dias seleccionados', JSON.stringify(creada.datos.plantillas.map(item => item.diaSemana)) === JSON.stringify(diasSemana));
  revisar('hereda la capacidad de la clase', creada.datos.capacidadHeredada === clase.capacidad);
  revisar('genera hasta el dia 56 inclusive', creada.datos.generacion?.hasta === fechaHasta, `-> ${creada.datos.generacion?.hasta}`);

  const esperadas = contarOcurrencias(fechaInicio, fechaHasta, diasSemana);
  revisar('genera el numero correcto de ocurrencias', creada.datos.generacion?.sesionesCreadas === esperadas, `-> ${creada.datos.generacion?.sesionesCreadas}/${esperadas}`);

  const horarios = await pedir('GET', '/admin/api/horarios?estatus=activo');
  const idsPlantillas = new Set(creada.datos.plantillas.map(item => item.idPlantilla));
  const sesiones = Array.isArray(horarios.datos)
    ? horarios.datos.filter(item => idsPlantillas.has(item.idPlantilla))
    : [];
  revisar('consulta todas las sesiones creadas', sesiones.length === esperadas, `-> ${sesiones.length}/${esperadas}`);
  revisar('las sesiones solo caen en los dias elegidos', sesiones.every(item => diasSemana.includes(new Date(`${item.fecha}T00:00:00.000Z`).getUTCDay())));
  revisar('cada sesion usa la capacidad de la clase', sesiones.every(item => item.capacidadTotal === clase.capacidad && item.capacidadDisponible === clase.capacidad));
  revisar('persiste la visibilidad configurada', sesiones.every(item => item.visibleReservas === false));
  revisar('persiste la lista de espera configurada', sesiones.every(item => item.listaEsperaHabilitada === true));

  await limpiar();

  const fechaFin = sumarDias(fechaInicio, 13);
  const finExplicito = await pedir('POST', '/admin/api/plantillas-horarios', {
    ...cuerpo,
    fechaFin,
  });
  revisar('crea una serie con fecha final explicita (201)', finExplicito.status === 201, `-> ${finExplicito.status} ${JSON.stringify(finExplicito.datos)}`);
  serieId = finExplicito.datos?.serieId || '';
  revisar('la generacion termina en la fecha indicada', finExplicito.datos?.generacion?.hasta === fechaFin);
  const esperadasConFin = contarOcurrencias(fechaInicio, fechaFin, diasSemana);
  revisar('la fecha final limita las ocurrencias generadas', finExplicito.datos?.generacion?.sesionesCreadas === esperadasConFin, `-> ${finExplicito.datos?.generacion?.sesionesCreadas}/${esperadasConFin}`);

  await limpiar();
  console.log('\n21/21 pruebas correctas.');
}

main().catch(async error => {
  console.error('La prueba se rompio:', error);
  try {
    await limpiar();
  } catch (limpiezaError) {
    console.error('Tambien fallo la limpieza:', limpiezaError);
  }
  process.exitCode = 1;
});