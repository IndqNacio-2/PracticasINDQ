// Prueba de extremo a extremo de POST /cobro/api/reservas.
// Se ejecuta contra el gateway unificado (localhost:3000).
// Uso: node pruebas-e2e-reservas.mjs
import { Client } from 'pg';
const BASE = process.env.BASE || 'http://localhost:3000';
const HOY = new Date().toISOString().slice(0, 10);

// La clase se descubre en tiempo de ejecución para no depender de ObjectIds de
// datos de prueba eliminados por la programación semanal.
let CLASE_ID = '';
let CLASE_NOMBRE = 'Pilates';
let PRECIO_ORIGINAL = 0;
const ENTRENADOR_ID = '6ace7f1744b33d079674a20b';
const ENTRENADOR = 'Marco Ruiz Soto';

let fallos = 0;
let pruebas = 0;
let horarioId = null;

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

/*
 * Crea un horario de prueba con cupo 2 para poder medir el limite de cupo.
 * Si ya existe uno para hoy a la misma hora, se borra y se vuelve a crear
 * para que la prueba siempre parta de un estado conocido.
 */
async function prepararHorario() {
  const existentes = await pedir(
    'GET',
    `/admin/api/horarios?fecha=${HOY}&estatus=activo`
  );
  for (const h of Array.isArray(existentes.datos) ? existentes.datos : []) {
    if (h.nombreClase === CLASE_NOMBRE && h.horaInicio === '22:00') {
      await pedir('DELETE', `/admin/api/horarios/${h.idHorario}`);
    }
  }

  const creado = await pedir('POST', '/admin/api/horarios', {
    idClase: CLASE_ID,
    nombreClase: CLASE_NOMBRE,
    entrenadorId: ENTRENADOR_ID,
    nombreEntrenador: ENTRENADOR,
    fecha: HOY,
    horaInicio: '22:00',
    horaFin: '23:00',
    capacidadTotal: 2,
    salon: 'Sala A',
  });
  if (creado.status !== 201) {
    throw new Error(`No se pudo crear el horario de prueba: ${JSON.stringify(creado.datos)}`);
  }
  horarioId = creado.datos.idHorario;
  console.log(`  (horario de prueba creado: ${horarioId}, cupo 2)`);
}

async function limpiar() {
  if (horarioId) {
    await pedir('DELETE', `/admin/api/horarios/${horarioId}`);
    console.log('  (horario de prueba eliminado)');
  }
}

// Limpia al final las reservas que creo la prueba. Se borran direto en
// PostgreSQL (no hay endpoint de borrado: la API solo cancela en soft delete).
const { PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD } = process.env;
async function borrarReservasDePrueba(ids) {
  if (!ids.length) return;
  const cliente = new Client({
    host: PGHOST || '127.0.0.1',
    port: Number(PGPORT || 5432),
    database: PGDATABASE || 'punto_venta',
    user: PGUSER || 'admin',
    password: PGPASSWORD || 'PuntoVenta2026',
  });
  await cliente.connect();
  try {
    await cliente.query('DELETE FROM webcobro.reservas WHERE id = ANY($1::int[])', [ids]);
  } finally {
    await cliente.end();
  }
}

async function main() {
  console.log(`\n=== POST /cobro/api/reservas (${HOY}) ===\n`);
  const catalogo = await pedir('GET', '/admin/api/clases');
  const claseOperativa = Array.isArray(catalogo.datos)
    ? catalogo.datos.find(clase => clase.nombre === CLASE_NOMBRE)
    : null;
  if (!claseOperativa) throw new Error('No existe Force Room. Ejecuta npm run db:cargar-programacion.');
  CLASE_ID = claseOperativa.idClase;
  CLASE_NOMBRE = claseOperativa.nombre;
  PRECIO_ORIGINAL = Number(claseOperativa.precio ?? 0);
  const tarifaPrueba = await pedir('PATCH', `/admin/api/clases/${CLASE_ID}`, { precio: 100 });
  if (tarifaPrueba.status !== 200) throw new Error('No se pudo preparar la tarifa temporal de prueba.');
  await prepararHorario();

  // 1. Sin clase/hora: debe fallar con 400.
  let r = await pedir('POST', '/cobro/api/reservas', {
    client: 'Ana Garcia',
    type: 'cliente',
    class: CLASE_NOMBRE,
    time: '22:00',
  });
  revisar('rechaza fecha ausente (400)', r.status === 400, `-> ${r.status} ${JSON.stringify(r.datos)}`);

  // 2. Fecha invalida.
  r = await pedir('POST', '/cobro/api/reservas', {
    client: 'Ana Garcia',
    type: 'cliente',
    class: CLASE_NOMBRE,
    time: '22:00',
    fecha: '2026-13-45',
  });
  revisar('rechaza fecha invalida (400)', r.status === 400, `-> ${r.status}`);

  // 3. Fecha en pasado.
  r = await pedir('POST', '/cobro/api/reservas', {
    client: 'Ana Garcia',
    type: 'cliente',
    class: CLASE_NOMBRE,
    time: '22:00',
    fecha: '2020-01-01',
  });
  revisar('rechaza fecha en pasado (400)', r.status === 400, `-> ${r.status}`);

  // 4. Horario inexistente (no hay horario activo de esa clase/hora).
  r = await pedir('POST', '/cobro/api/reservas', {
    client: 'Ana Garcia',
    type: 'cliente',
    class: CLASE_NOMBRE,
    time: '03:00',
    fecha: HOY,
  });
  revisar('rechaza horario inexistente (409)', r.status === 409, `-> ${r.status}`);

  // 5. Clase que no existe en el catalogo de administrativa.
  r = await pedir('POST', '/cobro/api/reservas', {
    client: 'Ana Garcia',
    type: 'cliente',
    class: 'clase inexistente',
    time: '22:00',
    fecha: HOY,
  });
  revisar('rechaza clase sin horario (409)', r.status === 409, `-> ${r.status}`);

  // 6. Reserva valida de un socio (debe crear y cobrar la tarifa de la clase).
  r = await pedir('POST', '/cobro/api/reservas', {
    client: 'Ana Garcia',
    type: 'cliente',
    class: CLASE_NOMBRE,
    time: '22:00',
    fecha: HOY,
  });
  revisar('crea reserva valida (201)', r.status === 201, `-> ${r.status} ${JSON.stringify(r.datos)}`);
  const reserva1 = r.datos?.reservacion;
  revisar('la reserva trae fecha', reserva1?.fecha === HOY, `-> ${reserva1?.fecha}`);
  revisar('el precio lo pone el servidor (100)', Number(reserva1?.price) === 100, `-> ${reserva1?.price}`);
  revisar('el estado inicial es pendiente', reserva1?.status === 'pendiente', `-> ${reserva1?.status}`);

  // 7. Duplicado: misma persona, misma clase, misma fecha y hora -> 409.
  r = await pedir('POST', '/cobro/api/reservas', {
    client: 'Ana Garcia',
    type: 'cliente',
    class: CLASE_NOMBRE,
    time: '22:00',
    fecha: HOY,
  });
  revisar('rechaza reserva duplicada (409)', r.status === 409, `-> ${r.status}`);

  // 8. Precio inventado por el navegador: el servidor lo ignora.
  r = await pedir('POST', '/cobro/api/reservas', {
    client: 'Luis Hernandez',
    type: 'cliente',
    class: CLASE_NOMBRE,
    time: '22:00',
    fecha: HOY,
    price: 1,
  });
  revisar('ignora el precio del navegador (201)', r.status === 201, `-> ${r.status}`);
  const reserva2 = r.datos?.reservacion;
  revisar('el precio real es 100, no 1', Number(reserva2?.price) === 100, `-> ${reserva2?.price}`);

  // 9. Cupo lleno: la capacidad del horario de prueba es 2 y ya hay 2 reservas.
  r = await pedir('POST', '/cobro/api/reservas', {
    client: 'Carlos Ruiz',
    type: 'visitante',
    class: CLASE_NOMBRE,
    time: '22:00',
    fecha: HOY,
  });
  revisar('rechaza cuando el cupo se lleno (409)', r.status === 409, `-> ${r.status}`);

  // 10. Visitante paga la tarifa.
  r = await pedir('POST', '/cobro/api/reservas', {
    client: 'Visitante Prueba',
    type: 'visitante',
    class: CLASE_NOMBRE,
    time: '22:00',
    fecha: HOY,
  });
  revisar('visitante paga la tarifa (409 por cupo lleno)', r.status === 409, `-> ${r.status}`);

  // 11. Se cancela una reserva y el cupo vuelve a estar disponible.
  let libre = null;
  if (reserva1?.id) {
    const cancelado = await pedir('PATCH', `/cobro/api/reservas/${reserva1.id}`, {
      status: 'cancelado',
    });
    revisar('cancela la reserva (200)', cancelado.status === 200, `-> ${cancelado.status}`);
    revisar(
      'la cancelacion conserva la fecha',
      cancelado.datos?.reservacion?.fecha === HOY,
      `-> ${cancelado.datos?.reservacion?.fecha}`
    );

    libre = await pedir('POST', '/cobro/api/reservas', {
      client: 'Carlos Ruiz',
      type: 'visitante',
      class: CLASE_NOMBRE,
      time: '22:00',
      fecha: HOY,
    });
    revisar(
      'el cupo se libera al cancelar (201)',
      libre.status === 201,
      `-> ${libre.status} ${JSON.stringify(libre.datos)}`
    );
    revisar(
      'el visitante paga la tarifa de la clase (100)',
      Number(libre.datos?.reservacion?.price) === 100,
      `-> ${libre.datos?.reservacion?.price}`
    );
  }

  // Se limpian las reservas creadas por la prueba.
  const creadas = [reserva1?.id, reserva2?.id, libre?.datos?.reservacion?.id].filter(Boolean);
  await borrarReservasDePrueba(creadas);
  console.log(`  (${creadas.length} reservas de prueba eliminadas)`);

  await limpiar();
  await pedir('PATCH', `/admin/api/clases/${CLASE_ID}`, { precio: PRECIO_ORIGINAL });

  console.log(`\n${pruebas - fallos}/${pruebas} pruebas correctas.`);
  if (fallos > 0) {
    console.log(`FALLOS: ${fallos}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('La prueba se rompio:', err);
  process.exitCode = 1;
}).finally(async () => {
  if (CLASE_ID) {
    await pedir('PATCH', `/admin/api/clases/${CLASE_ID}`, { precio: PRECIO_ORIGINAL }).catch(() => undefined);
  }
});
