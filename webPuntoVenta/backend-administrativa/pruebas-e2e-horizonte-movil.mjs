/*
 * Prueba que el mantenimiento complete hoy + 55, sea idempotente y respete
 * tanto una excepcion editada como una ocurrencia desactivada.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

const BASE = process.env.BASE || 'http://localhost:3000';
const MS_DIA = 24 * 60 * 60 * 1000;
const serieId = crypto.randomUUID();
let idPlantilla = '';

function fechaISO(fecha) { return fecha.toISOString().slice(0, 10); }
function sumarDias(fecha, dias) {
  return fechaISO(new Date(new Date(`${fecha}T00:00:00.000Z`).getTime() + dias * MS_DIA));
}
function revisar(nombre, condicion, detalle = '') {
  if (!condicion) throw new Error(`${nombre} ${detalle}`);
  console.log(`  OK   ${nombre}`);
}
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

async function conBase(fn) {
  await mongoose.connect(process.env.MONGO_URI);
  try { return await fn(mongoose.connection.db); }
  finally { await mongoose.disconnect(); }
}

async function limpiar() {
  if (!process.env.MONGO_URI) return;
  const resultado = await conBase(async db => {
    const sesiones = await db.collection('webadministrativa_horarios').deleteMany({ idPlantilla });
    const plantillas = await db.collection('webadministrativa_plantillas_horarios').deleteMany({ serieId });
    return { sesiones: sesiones.deletedCount, plantillas: plantillas.deletedCount };
  });
  console.log(`  (${resultado.plantillas} plantilla y ${resultado.sesiones} sesiones temporales eliminadas)`);
}

async function main() {
  console.log('\nPruebas de horizonte movil de 56 dias');
  revisar('tiene MONGO_URI para preparar y limpiar la prueba', Boolean(process.env.MONGO_URI));

  const hoy = fechaISO(new Date());
  const fechaExcepcion = sumarDias(hoy, 48);
  const fechaInactiva = sumarDias(hoy, 41);
  const fechaExtremo = sumarDias(hoy, 55);
  const marca = Date.now();

  await conBase(async db => {
    const plantilla = await db.collection('webadministrativa_plantillas_horarios').insertOne({
      clave: `${serieId}|horizonte`, serieId,
      idClase: `e2e-clase-${marca}`, nombreClase: 'E2E Horizonte movil',
      entrenadorId: `e2e-entrenador-${marca}`, nombreEntrenador: 'E2E Instructor',
      diaSemana: new Date(`${fechaExtremo}T00:00:00.000Z`).getUTCDay(),
      horaInicio: '05:00', horaFin: '06:00', capacidadTotal: 8,
      salon: `Sala E2E Horizonte ${marca}`, vigenteDesde: hoy, vigenteHasta: '',
      visibleReservas: true, listaEsperaHabilitada: false, estatus: 'activo',
      fechaCreacion: new Date(), fechaActualizacion: new Date(),
    });
    idPlantilla = plantilla.insertedId.toString();
    await db.collection('webadministrativa_horarios').insertMany([
      {
        idClase: `e2e-clase-${marca}`, nombreClase: 'E2E Horizonte movil',
        entrenadorId: `e2e-entrenador-${marca}`, nombreEntrenador: 'E2E Instructor',
        fecha: fechaExcepcion, horaInicio: '07:00', horaFin: '08:00',
        capacidadTotal: 8, capacidadDisponible: 8, estatus: 'activo',
        salon: `Sala E2E Excepcion ${marca}`, idPlantilla,
        claveGeneracion: `${idPlantilla}:${fechaExcepcion}`, origen: 'plantilla',
        esExcepcionPlantilla: true, visibleReservas: false, listaEsperaHabilitada: false,
      },
      {
        idClase: `e2e-clase-${marca}`, nombreClase: 'E2E Horizonte movil',
        entrenadorId: `e2e-entrenador-${marca}`, nombreEntrenador: 'E2E Instructor',
        fecha: fechaInactiva, horaInicio: '05:00', horaFin: '06:00',
        capacidadTotal: 8, capacidadDisponible: 8, estatus: 'inactivo',
        salon: `Sala E2E Horizonte ${marca}`, idPlantilla,
        claveGeneracion: `${idPlantilla}:${fechaInactiva}`, origen: 'plantilla',
        esExcepcionPlantilla: false, visibleReservas: true, listaEsperaHabilitada: false,
      },
    ]);
  });

  const primera = await pedir('POST', '/admin/api/plantillas-horarios/mantener-horizonte');
  revisar('ejecuta el mantenimiento (200)', primera.status === 200, `-> ${primera.status} ${JSON.stringify(primera.datos)}`);
  revisar('usa una ventana exacta de 56 dias', primera.datos.desde === hoy && primera.datos.hasta === fechaExtremo);

  const trasPrimera = await conBase(db => db.collection('webadministrativa_horarios')
    .find({ idPlantilla }).sort({ fecha: 1 }).toArray());
  const extremo = trasPrimera.find(item => item.fecha === fechaExtremo);
  const excepcion = trasPrimera.find(item => item.fecha === fechaExcepcion);
  const inactiva = trasPrimera.find(item => item.fecha === fechaInactiva);
  revisar('genera la fecha que entra al extremo del horizonte', extremo?.claveGeneracion === `${idPlantilla}:${fechaExtremo}`);
  revisar('no sobrescribe la excepcion individual', excepcion?.horaInicio === '07:00' && excepcion?.esExcepcionPlantilla === true && excepcion?.visibleReservas === false);
  revisar('no reactiva una sesion inactiva', inactiva?.estatus === 'inactivo');

  const segunda = await pedir('POST', '/admin/api/plantillas-horarios/mantener-horizonte');
  revisar('permite repetir el mantenimiento (200)', segunda.status === 200);
  revisar('la segunda ejecucion no crea duplicados', segunda.datos.sesionesCreadas === 0);
  const trasSegunda = await conBase(db => db.collection('webadministrativa_horarios')
    .countDocuments({ idPlantilla, claveGeneracion: `${idPlantilla}:${fechaExtremo}` }));
  revisar('existe una sola ocurrencia para el extremo', trasSegunda === 1);

  await limpiar();
  console.log('\n9/9 pruebas correctas.');
}

main().catch(async error => {
  console.error('La prueba se rompio:', error);
  try { await limpiar(); } catch (limpiezaError) { console.error('Tambien fallo la limpieza:', limpiezaError); }
  process.exitCode = 1;
});