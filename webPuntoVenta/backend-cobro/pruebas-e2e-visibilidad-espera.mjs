// Prueba E2E de visibilidad publica, lista de espera y promocion automatica.
// Requiere el gateway unificado en http://localhost:3000 y las bases locales.
// Uso: node pruebas-e2e-visibilidad-espera.mjs
import 'dotenv/config';
import { Client } from 'pg';

const BASE = process.env.BASE || 'http://localhost:3000';
const fecha = new Date();
fecha.setDate(fecha.getDate() + 1);
const FECHA = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
const sufijo = `${Date.now()}`;

let horarioId = '';
const reservasCreadas = [];
let pruebas = 0;
let fallos = 0;

async function pedir(metodo, ruta, cuerpo) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const datos = await respuesta.json().catch(() => null);
  return { status: respuesta.status, datos };
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

async function limpiar() {
  if (reservasCreadas.length) {
    const cliente = new Client({
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
    });
    await cliente.connect();
    try {
      await cliente.query('DELETE FROM webcobro.reservas WHERE id = ANY($1::int[])', [reservasCreadas]);
    } finally {
      await cliente.end();
    }
  }
  if (horarioId) await pedir('DELETE', `/admin/api/horarios/${horarioId}`);
}

async function main() {
  console.log(`\n=== Visibilidad y lista de espera (${FECHA}) ===\n`);

  const catalogo = await pedir('GET', '/admin/api/clases');
  const clase = Array.isArray(catalogo.datos)
    ? catalogo.datos.find(item => item.estatus === 'activo' && Number(item.precio) > 0 && Number(item.capacidad) >= 1)
    : null;
  if (!clase) throw new Error('No hay una clase activa con precio y capacidad validos para la prueba.');
  const sesionesActivas = await pedir('GET', '/admin/api/horarios?estatus=activo');
  const sesionConEntrenador = Array.isArray(sesionesActivas.datos)
    ? sesionesActivas.datos.find(item => item.entrenadorId)
    : null;
  if (!sesionConEntrenador) throw new Error('No hay una sesión activa con instructor para la prueba.');

  const creado = await pedir('POST', '/admin/api/horarios', {
    idClase: clase.idClase,
    entrenadorId: sesionConEntrenador.entrenadorId,
    fecha: FECHA,
    horaInicio: '22:30',
    horaFin: '23:30',
    capacidadTotal: 1,
    salon: `Sala E2E ${sufijo}`,
    estatus: 'activo',
    visibleReservas: false,
    listaEsperaHabilitada: true,
  });
  revisar('crea sesion oculta con lista de espera (201)', creado.status === 201, JSON.stringify(creado.datos));
  horarioId = creado.datos?.idHorario ?? '';
  if (!horarioId) throw new Error('La sesion de prueba no devolvio idHorario.');

  const admin = await pedir('GET', `/admin/api/horarios?fecha=${FECHA}&estatus=activo`);
  revisar(
    'Administracion conserva visible la sesion oculta',
    Array.isArray(admin.datos) && admin.datos.some(item => item.idHorario === horarioId),
  );

  const publicas = await pedir('GET', `/admin/api/horarios/reservables?fecha=${FECHA}`);
  revisar(
    'la consulta publica no devuelve la sesion oculta',
    Array.isArray(publicas.datos) && !publicas.datos.some(item => item.idHorario === horarioId),
  );

  const cuerpoBase = {
    type: 'visitante',
    class: clase.nombre,
    time: '22:30',
    fecha: FECHA,
    horarioId,
  };
  const primera = await pedir('POST', '/cobro/api/reservas', {
    ...cuerpoBase,
    client: `Confirmado ${sufijo}`,
  });
  revisar('la primera reserva queda confirmada (201)', primera.status === 201, JSON.stringify(primera.datos));
  revisar('la primera ocupa el lugar', primera.datos?.reservacion?.capacityStatus === 'confirmada');
  if (primera.datos?.reservacion?.id) reservasCreadas.push(primera.datos.reservacion.id);

  const segunda = await pedir('POST', '/cobro/api/reservas', {
    ...cuerpoBase,
    client: `Espera ${sufijo}`,
  });
  revisar('la siguiente reserva entra a lista de espera (201)', segunda.status === 201, JSON.stringify(segunda.datos));
  revisar('la reserva en espera no figura como confirmada', segunda.datos?.reservacion?.capacityStatus === 'espera');
  if (segunda.datos?.reservacion?.id) reservasCreadas.push(segunda.datos.reservacion.id);

  const cancelada = await pedir('PATCH', `/cobro/api/reservas/${primera.datos?.reservacion?.id}`, {
    status: 'cancelado',
  });
  revisar('cancela la confirmada (200)', cancelada.status === 200, JSON.stringify(cancelada.datos));
  revisar(
    'promueve automaticamente a la primera persona en espera',
    cancelada.datos?.promovida?.id === segunda.datos?.reservacion?.id
      && cancelada.datos?.promovida?.capacityStatus === 'confirmada',
    JSON.stringify(cancelada.datos?.promovida),
  );

  const listado = await pedir('GET', '/cobro/api/reservas');
  const promovidaPersistida = Array.isArray(listado.datos)
    ? listado.datos.find(item => item.id === segunda.datos?.reservacion?.id)
    : null;
  revisar('la promocion queda persistida', promovidaPersistida?.capacityStatus === 'confirmada');

  await limpiar();
  console.log(`\n${pruebas - fallos}/${pruebas} pruebas correctas.`);
  if (fallos) process.exitCode = 1;
}

main().catch(async error => {
  console.error('La prueba se rompio:', error);
  process.exitCode = 1;
  await limpiar().catch(() => undefined);
});