/*
 * Pruebas de extremo a extremo del modulo de HORARIOS de la administrativa.
 *
 * Comprueban las reglas de la agenda:
 *   - La fecha y el intervalo (horaInicio/horaFin) son obligatorios.
 *   - La duracion minima de una sesion es de 30 minutos.
 *   - Un entrenador no puede tener dos horarios que se solapen.
 *   - Al editar, el propio horario no se cuenta como solapamiento.
 *   - Los datos mal formados se rechazan con un 400 (y no con un 500).
 *   - Las referencias (clase, entrenador) y la capacidad son coherentes.
 *
 * Se ejecuta contra el gateway unificado (localhost:3000).
 * Uso: node pruebas-e2e-horarios.mjs
 */

const BASE = process.env.BASE || 'http://localhost:3000';
const HOY = new Date().toISOString().slice(0, 10);

// La clase se descubre en tiempo de ejecución para no depender de ObjectIds de
// datos de prueba. La carga semanal garantiza que Pilates exista.
let CLASE_ID = '';
let CLASE_NOMBRE = 'Pilates';
let CLASE_CAPACIDAD = 0;
const ENTRENADOR_ID = '6ace7f1744b33d079674a20b';
const ENTRENADOR = 'Marco Ruiz Soto';

// Usuario que existe pero NO es entrenador (es recepcion).
const RECEPCION_ID = '6ace7f0044b33d079674a203';
// ObjectId con formato valido pero que no esta en la base de datos.
const ID_INEXISTENTE = '6acd3f404389b40c9342ffff';

let fallos = 0;
let pruebas = 0;
const idsCreados = [];

async function pedir(metodo, ruta, cuerpo) {
  const res = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  let datos = null;
  try {
    datos = await res.json();
  } catch {
    datos = null;
  }
  return { status: res.status, datos };
}

function revisar(nombre, condicion, detalle = '') {
  pruebas += 1;
  if (condicion) {
    console.log(`  OK   ${nombre}`);
  } else {
    fallos += 1;
    console.log(`  FALLA ${nombre} ${detalle}`);
  }
}

/* Cuerpo base de un horario valido. */
function cuerpoHorario(extra = {}) {
  return {
    idClase: CLASE_ID,
    nombreClase: CLASE_NOMBRE,
    entrenadorId: ENTRENADOR_ID,
    nombreEntrenador: ENTRENADOR,
    fecha: HOY,
    horaInicio: '06:00',
    horaFin: '07:00',
    capacidadTotal: 5,
    salon: 'Sala E2E',
    ...extra,
  };
}

async function limpiar() {
  for (const id of idsCreados) {
    await pedir('DELETE', `/admin/api/horarios/${id}`);
  }
  if (idsCreados.length) {
    console.log(`  (${idsCreados.length} horarios de prueba eliminados)`);
  }
}


async function main() {
  console.log('Pruebas de horarios (administrativa)');

  const catalogo = await pedir('GET', '/admin/api/clases');
  const claseOperativa = Array.isArray(catalogo.datos)
    ? catalogo.datos.find(clase => clase.nombre === CLASE_NOMBRE)
    : null;
  if (!claseOperativa) throw new Error('No existe Pilates. Ejecuta npm run db:cargar-programacion.');
  CLASE_ID = claseOperativa.idClase;
  CLASE_NOMBRE = claseOperativa.nombre;
  CLASE_CAPACIDAD = Number(claseOperativa.capacidad);

  // 1. Crear un horario valido: debe devolver 201.
  const creado = await pedir('POST', '/admin/api/horarios', cuerpoHorario());
  revisar('crea un horario valido (201)', creado.status === 201, `-> ${creado.status} ${JSON.stringify(creado.datos)}`);
  const id = creado.datos?.idHorario;
  if (id) idsCreados.push(id);

  // 2. Sin hora de inicio: 400.
  const sinHora = await pedir('POST', '/admin/api/horarios', cuerpoHorario({ horaInicio: undefined }));
  revisar('rechaza un horario sin hora de inicio (400)', sinHora.status === 400, `-> ${sinHora.status}`);

  // 3. Sin hora de fin: 400.
  const sinFin = await pedir('POST', '/admin/api/horarios', cuerpoHorario({ horaFin: undefined }));
  revisar('rechaza un horario sin hora de fin (400)', sinFin.status === 400, `-> ${sinFin.status}`);

  // 4. Duracion menor a 30 minutos: 400.
  const corta = await pedir('POST', '/admin/api/horarios', cuerpoHorario({ horaInicio: '08:00', horaFin: '08:29' }));
  revisar('rechaza una duracion menor a 30 minutos (400)', corta.status === 400, `-> ${corta.status}`);
  revisar(
    'el error de duracion minima explica el limite de 30 minutos',
    typeof corta.datos?.error === 'string' && corta.datos.error.includes('30'),
    `-> ${corta.datos?.error}`
  );

  // 5. Duracion de exactamente 30 minutos: 201.
  const duracionMinima = await pedir('POST', '/admin/api/horarios', cuerpoHorario({
    horaInicio: '07:00',
    horaFin: '07:30',
    salon: 'Sala E2E 30 minutos',
  }));
  revisar('acepta exactamente 30 minutos (201)', duracionMinima.status === 201, `-> ${duracionMinima.status} ${JSON.stringify(duracionMinima.datos)}`);
  if (duracionMinima.datos?.idHorario) idsCreados.push(duracionMinima.datos.idHorario);

  // Una sesion de 60 minutos sigue siendo valida al superar el minimo.
  const exacta = await pedir('POST', '/admin/api/horarios', cuerpoHorario({ horaInicio: '10:00', horaFin: '11:00' }));
  revisar('acepta una duracion de 60 minutos (201)', exacta.status === 201, `-> ${exacta.status} ${JSON.stringify(exacta.datos)}`);
  if (exacta.datos?.idHorario) idsCreados.push(exacta.datos.idHorario);


  // 6. Hora de fin anterior a la de inicio: 400.
  const invertida = await pedir('POST', '/admin/api/horarios', cuerpoHorario({ horaInicio: '14:00', horaFin: '13:00' }));
  revisar('rechaza una hora de fin anterior a la de inicio (400)', invertida.status === 400, `-> ${invertida.status}`);

  // 7. Solapamiento con el primer horario del mismo entrenador: 409.
  const solapado = await pedir('POST', '/admin/api/horarios', cuerpoHorario({ horaInicio: '06:30', horaFin: '07:30' }));
  revisar('rechaza un horario que se solapa con otro del mismo entrenador (409)', solapado.status === 409, `-> ${solapado.status}`);
  revisar(
    'el error de solapamiento menciona al entrenador',
    typeof solapado.datos?.error === 'string' && solapado.datos.error.includes('entrenador'),
    `-> ${solapado.datos?.error}`
  );

  // 8. Editar el horario a un intervalo que se solapa con el otro: 409.
  //    (El propio horario editado no debe contarse como solapamiento.)
  const edicionSolapada = await pedir('PATCH', `/admin/api/horarios/${id}`, { horaInicio: '10:30', horaFin: '11:30' });
  revisar('rechaza editar a un intervalo solapado (409)', edicionSolapada.status === 409, `-> ${edicionSolapada.status}`);

  // 9. Editar el horario a una duracion menor a 30 minutos: 400.
  const edicionCorta = await pedir('PATCH', `/admin/api/horarios/${id}`, { horaInicio: '06:00', horaFin: '06:29' });
  revisar('rechaza editar a una duracion menor a 30 minutos (400)', edicionCorta.status === 400, `-> ${edicionCorta.status}`);

  // 10. Editar el horario a un intervalo libre: 200 y persiste los cambios.
  const edicionValida = await pedir('PATCH', `/admin/api/horarios/${id}`, { horaInicio: '16:00', horaFin: '17:00' });
  revisar('acepta editar a un intervalo libre (200)', edicionValida.status === 200, `-> ${edicionValida.status} ${JSON.stringify(edicionValida.datos)}`);
  revisar(
    'la edicion guarda la nueva hora de inicio',
    edicionValida.datos?.horaInicio === '16:00',
    `-> ${edicionValida.datos?.horaInicio}`
  );
  revisar(
    'la edicion guarda la nueva hora de fin',
    edicionValida.datos?.horaFin === '17:00',
    `-> ${edicionValida.datos?.horaFin}`
  );

  // 11. Editar sin cambiar las horas no debe chocar consigo mismo: 200.
  const edicionMisma = await pedir('PATCH', `/admin/api/horarios/${id}`, { salon: 'Sala E2E B' });
  revisar('editar sin cambiar el intervalo no se solapa consigo mismo (200)', edicionMisma.status === 200, `-> ${edicionMisma.status} ${JSON.stringify(edicionMisma.datos)}`);

  // 12. La clase ya no expone el campo "hora" (la fecha y el intervalo viven
  //     en los horarios).
  const clases = await pedir('GET', '/admin/api/clases');
  const conHora = Array.isArray(clases.datos) ? clases.datos.filter(c => 'hora' in c) : [];
  revisar('las clases ya no tienen campo "hora"', conHora.length === 0, `-> ${conHora.length} clases con "hora"`);

  // 13. Datos mal formados: todos deben ser 400 (nunca un 500 de servidor).
  const malFormados = [
    ['idClase que no es un ObjectId', { idClase: 'no-es-un-id' }],
    ['entrenadorId que no es un ObjectId', { entrenadorId: '123' }],
    ['fecha con formato invalido', { fecha: 'manana' }],
    ['fecha que no existe en el calendario', { fecha: '2026-02-30' }],
    ['capacidad en cero', { capacidadTotal: 0 }],
    ['capacidad negativa', { capacidadTotal: -5 }],
    ['capacidad decimal', { capacidadTotal: 7.5 }],
    ['capacidad como texto', { capacidadTotal: 'muchos' }],
    ['sala vacia', { salon: '   ' }],
    ['estatus desconocido', { estatus: 'xxx' }],
    ['hora de inicio que no es HH:MM', { horaInicio: '9:00' }],
    ['hora de fin que no existe', { horaFin: '25:00' }],
  ];
  for (const [nombre, extra] of malFormados) {
    const r = await pedir('POST', '/admin/api/horarios', cuerpoHorario(extra));
    revisar(`rechaza ${nombre} (400)`, r.status === 400, `-> ${r.status} ${JSON.stringify(r.datos)}`);
  }

  // 14. Referencias que no existen: la clase y el entrenador deben existir.
  const claseInexistente = await pedir('POST', '/admin/api/horarios', cuerpoHorario({ idClase: ID_INEXISTENTE }));
  revisar('rechaza una clase que no existe (404)', claseInexistente.status === 404, `-> ${claseInexistente.status} ${JSON.stringify(claseInexistente.datos)}`);

  const entrenadorInexistente = await pedir('POST', '/admin/api/horarios', cuerpoHorario({ entrenadorId: ID_INEXISTENTE }));
  revisar('rechaza un entrenador que no existe (404)', entrenadorInexistente.status === 404, `-> ${entrenadorInexistente.status} ${JSON.stringify(entrenadorInexistente.datos)}`);

  // 15. Un usuario que existe pero no es entrenador no puede dar clase.
  const noEntrenador = await pedir('POST', '/admin/api/horarios', cuerpoHorario({ entrenadorId: RECEPCION_ID }));
  revisar('rechaza un usuario que no es entrenador (400)', noEntrenador.status === 400, `-> ${noEntrenador.status} ${JSON.stringify(noEntrenador.datos)}`);

  // 16. La capacidad del horario no puede superar la de su clase.
  const capacidadExcesiva = await pedir('POST', '/admin/api/horarios', cuerpoHorario({ capacidadTotal: CLASE_CAPACIDAD + 1 }));
  revisar('rechaza una capacidad mayor que la de la clase (409)', capacidadExcesiva.status === 409, `-> ${capacidadExcesiva.status} ${JSON.stringify(capacidadExcesiva.datos)}`);

  // 17. El servidor pone el nombre de la clase y el del entrenador: el
  //     navegador no puede inventarlos ni dejarlos vacios.
  const conNombresFalsos = await pedir('POST', '/admin/api/horarios', cuerpoHorario({ nombreClase: 'inventado', nombreEntrenador: 'inventado' }));
  revisar('acepta el horario aunque el navegador invente los nombres (201)', conNombresFalsos.status === 201, `-> ${conNombresFalsos.status} ${JSON.stringify(conNombresFalsos.datos)}`);
  if (conNombresFalsos.datos?.idHorario) idsCreados.push(conNombresFalsos.datos.idHorario);
  revisar(
    'el nombre de la clase lo pone el servidor',
    conNombresFalsos.datos?.nombreClase === CLASE_NOMBRE,
    `-> ${conNombresFalsos.datos?.nombreClase}`
  );
  revisar(
    'el nombre del entrenador lo pone el servidor',
    conNombresFalsos.datos?.nombreEntrenador === ENTRENADOR,
    `-> ${conNombresFalsos.datos?.nombreEntrenador}`
  );

  // 18. Editar un horario con datos mal formados tambien da 400 (no 500).
  const edicionMalFormada = [
    ['idClase invalido', { idClase: 'no-es-un-id' }],
    ['fecha invalida', { fecha: '2026-13-45' }],
    ['capacidad en cero', { capacidadTotal: 0 }],
    ['estatus desconocido', { estatus: 'xxx' }],
  ];
  for (const [nombre, extra] of edicionMalFormada) {
    const r = await pedir('PATCH', `/admin/api/horarios/${id}`, extra);
    revisar(`rechaza editar con ${nombre} (400)`, r.status === 400, `-> ${r.status} ${JSON.stringify(r.datos)}`);
  }

  // 19. Un id de horario que no es un ObjectId no puede ser real.
  const idInvalido = await pedir('PATCH', '/admin/api/horarios/no-es-un-id', { horaInicio: '16:00' });
  revisar('rechaza editar un id de horario invalido (400)', idInvalido.status === 400, `-> ${idInvalido.status} ${JSON.stringify(idInvalido.datos)}`);

  const idInexistente = await pedir('PATCH', `/admin/api/horarios/${ID_INEXISTENTE}`, { horaInicio: '16:00' });
  revisar('rechaza editar un horario que no existe (404)', idInexistente.status === 404, `-> ${idInexistente.status} ${JSON.stringify(idInexistente.datos)}`);

  // 20. Editar con un campo que no existe en el horario: 400.
  const campoDesconocido = await pedir('PATCH', `/admin/api/horarios/${id}`, { campoInventado: 'valor' });
  revisar('rechaza editar con un campo desconocido (400)', campoDesconocido.status === 400, `-> ${campoDesconocido.status} ${JSON.stringify(campoDesconocido.datos)}`);

  // 21. Editar sin mandar nada: 400.
  const edicionVacia = await pedir('PATCH', `/admin/api/horarios/${id}`, {});
  revisar('rechaza editar sin ningun cambio (400)', edicionVacia.status === 400, `-> ${edicionVacia.status} ${JSON.stringify(edicionVacia.datos)}`);

  // 22. Borrar un horario con un id invalido: 400 (no 500).
  const borrarInvalido = await pedir('DELETE', '/admin/api/horarios/no-es-un-id');
  revisar('rechaza borrar un id de horario invalido (400)', borrarInvalido.status === 400, `-> ${borrarInvalido.status} ${JSON.stringify(borrarInvalido.datos)}`);

  // 23. Los filtros del listado tambien se validan.
  const filtroFechaMala = await pedir('GET', '/admin/api/horarios?fecha=ayer');
  revisar('rechaza filtrar por una fecha invalida (400)', filtroFechaMala.status === 400, `-> ${filtroFechaMala.status} ${JSON.stringify(filtroFechaMala.datos)}`);

  const filtroEstatusMalo = await pedir('GET', '/admin/api/horarios?estatus=xxx');
  revisar('rechaza filtrar por un estatus desconocido (400)', filtroEstatusMalo.status === 400, `-> ${filtroEstatusMalo.status} ${JSON.stringify(filtroEstatusMalo.datos)}`);

  const filtroValido = await pedir('GET', `/admin/api/horarios?fecha=${HOY}&estatus=activo`);
  revisar('acepta filtrar por fecha y estatus validos (200)', filtroValido.status === 200, `-> ${filtroValido.status} ${JSON.stringify(filtroValido.datos)}`);

  await limpiar();

  console.log(`\n${pruebas - fallos}/${pruebas} pruebas correctas.`);
  if (fallos > 0) {
    console.log(`FALLOS: ${fallos}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('La prueba se rompio:', err);
  process.exitCode = 1;
});
