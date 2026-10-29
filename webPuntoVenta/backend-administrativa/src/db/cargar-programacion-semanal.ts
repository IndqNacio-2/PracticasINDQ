/**
 * Carga idempotente de la programación semanal tomada de la aplicación móvil.
 * Force Room y Reset Room se manejan exclusivamente como salas; las clases
 * reservables son Pilates y Yoga. Open Gym representa que el gimnasio esta
 * abierto, por lo que no se guarda como clase ni como horario reservable.
 *
 * Uso: npm run db:cargar-programacion
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Clase } from '../models/Clases/clases';
import { Horario } from '../models/Horarios/horarios';
import { PlantillaHorario } from '../models/PlantillasHorarios/plantillasHorarios';
import { Usuario } from '../models/Usuarios/usuarios';
import { generarSesionesDesdePlantillas } from '../services/generar-sesiones';

const VIGENTE_DESDE = '2026-10-27';
const DIAS_GENERADOS = 90;
const CLASES_RETIRADAS = ['Force Room', 'Reset Room', 'Open Gym'];
const API_RESERVAS = process.env.COBRO_RESERVAS_URL ?? 'http://localhost:3000/cobro/api/reservas';

const entrenadores = [
    { nombre: 'Andrea', apellidos: 'Solís', correo: 'andrea.solis@gymfit.mx', codigoAcceso: 'ENT002' },
    { nombre: 'Luis', apellidos: 'Herrera', correo: 'luis.herrera@gymfit.mx', codigoAcceso: 'ENT003' },
    { nombre: 'Paola', apellidos: 'Ibarra', correo: 'paola.ibarra@gymfit.mx', codigoAcceso: 'ENT004' },
    { nombre: 'Diego', apellidos: 'Mora', correo: 'diego.mora@gymfit.mx', codigoAcceso: 'ENT005' },
] as const;

const catalogo = [
    {
        nombre: 'Pilates',
        descripcion: 'Clase de Pilates incluida en el paquete mostrado en la aplicación móvil.',
        capacidad: 12,
        precio: 0,
        color: '#B8F23E',
    },
    {
        nombre: 'Yoga',
        descripcion: 'Clase de Yoga con pago en recepción.',
        capacidad: 10,
        precio: 180,
        color: '#8FD12A',
    },
] as const;

type NombreClase = typeof catalogo[number]['nombre'];
type NombreEntrenador = `${typeof entrenadores[number]['nombre']} ${typeof entrenadores[number]['apellidos']}`;

interface Regla {
    clase: NombreClase;
    salon: 'Force Room' | 'Reset Room';
    entrenador?: NombreEntrenador;
    diaSemana: number;
    horaInicio: string;
    horaFin: string;
    capacidadTotal: number;
}

interface ReservaCobro {
    class?: string;
    time?: string;
    fecha?: string;
}

function sumarMinutos(hora: string, minutos: number): string {
    const [horas, mins] = hora.split(':').map(Number);
    const total = horas * 60 + mins + minutos;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function agregarRegla(
    reglas: Regla[],
    diaSemana: number,
    horaInicio: string,
    clase: 'Pilates' | 'Yoga',
    entrenador: NombreEntrenador,
    capacidadTotal: number
): void {
    reglas.push({
        clase,
        salon: clase === 'Pilates' ? 'Force Room' : 'Reset Room',
        entrenador,
        diaSemana,
        horaInicio,
        horaFin: sumarMinutos(horaInicio, 50),
        capacidadTotal,
    });
}

function construirReglas(): Regla[] {
    const reglas: Regla[] = [];
    const semana = [
        ['06:00', 'Pilates', 'Andrea Solís', 12],
        ['07:00', 'Yoga', 'Luis Herrera', 10],
        ['09:00', 'Pilates', 'Paola Ibarra', 12],
        ['12:00', 'Yoga', 'Diego Mora', 10],
        ['17:00', 'Pilates', 'Andrea Solís', 12],
        ['18:00', 'Yoga', 'Luis Herrera', 10],
        ['19:00', 'Pilates', 'Paola Ibarra', 12],
    ] as const;
    const sabado = [
        ['08:00', 'Pilates', 'Paola Ibarra', 12],
        ['10:00', 'Yoga', 'Diego Mora', 10],
        ['12:00', 'Pilates', 'Andrea Solís', 12],
        ['14:00', 'Yoga', 'Luis Herrera', 10],
    ] as const;
    const domingo = [
        ['09:00', 'Pilates', 'Andrea Solís', 12],
        ['10:00', 'Yoga', 'Diego Mora', 10],
    ] as const;

    for (const diaSemana of [1, 2, 3, 4]) {
        for (const [hora, clase, entrenador, capacidad] of semana) {
            agregarRegla(reglas, diaSemana, hora, clase, entrenador, capacidad);
        }
    }
    for (const [hora, clase, entrenador, capacidad] of semana.slice(0, 6)) {
        agregarRegla(reglas, 5, hora, clase, entrenador, capacidad);
    }
    for (const [hora, clase, entrenador, capacidad] of sabado) {
        agregarRegla(reglas, 6, hora, clase, entrenador, capacidad);
    }
    for (const [hora, clase, entrenador, capacidad] of domingo) {
        agregarRegla(reglas, 0, hora, clase, entrenador, capacidad);
    }

    return reglas;
}

async function obtenerReservasProtegidas(): Promise<Set<string>> {
    const controlador = new AbortController();
    const timeout = setTimeout(() => controlador.abort(), 10_000);
    try {
        const respuesta = await fetch(API_RESERVAS, { signal: controlador.signal });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        const reservas = await respuesta.json() as ReservaCobro[];
        if (!Array.isArray(reservas)) throw new Error('la respuesta no es una lista');
        return new Set(
            reservas
                .filter(reserva => reserva.fecha && reserva.class && reserva.time)
                .map(reserva => `${reserva.class}|${reserva.fecha}|${reserva.time}`)
        );
    } catch (error) {
        throw new Error(`No se pudieron comprobar las reservaciones en ${API_RESERVAS}; se canceló la migración para proteger datos. ${error}`);
    } finally {
        clearTimeout(timeout);
    }
}

async function main(): Promise<void> {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('Falta MONGO_URI en el .env');

    // Esta comprobación ocurre antes de modificar MongoDB.
    const reservasProtegidas = await obtenerReservasProtegidas();
    await mongoose.connect(uri);

    const entrenadoresPorNombre = new Map<string, any>();
    for (const datos of entrenadores) {
        let usuario = await Usuario.findOne({ correo: datos.correo });
        if (!usuario) {
            usuario = await Usuario.create({
                ...datos,
                telefono: '',
                rol: 'entrenador',
                estatus: 'activo',
                password: bcrypt.hashSync(crypto.randomBytes(24).toString('base64url'), 10),
            });
        } else {
            usuario = await Usuario.findByIdAndUpdate(
                usuario._id,
                { ...datos, rol: 'entrenador', estatus: 'activo' },
                { new: true }
            );
        }
        entrenadoresPorNombre.set(`${datos.nombre} ${datos.apellidos}`, usuario);
    }

    const clasesPorNombre = new Map<string, any>();
    for (const datos of catalogo) {
        const clase = await Clase.findOneAndUpdate(
            { nombre: datos.nombre },
            { $set: { ...datos, estatus: 'activo', entrenadorId: '' } },
            { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
        );
        clasesPorNombre.set(datos.nombre, clase);
    }

    const sesionesProvisionales = await Horario.find({
        origen: 'plantilla',
        fecha: { $gte: VIGENTE_DESDE },
        nombreClase: { $in: CLASES_RETIRADAS },
    }).select('_id idPlantilla nombreClase fecha horaInicio');
    const sesionesEliminables = sesionesProvisionales.filter(sesion => (
        !reservasProtegidas.has(`${sesion.nombreClase}|${sesion.fecha}|${sesion.horaInicio}`)
    ));
    const idsEliminables = new Set(sesionesEliminables.map(sesion => sesion._id.toString()));
    const idsPlantillasProtegidas = new Set(
        sesionesProvisionales
            .filter(sesion => !idsEliminables.has(sesion._id.toString()))
            .map(sesion => sesion.idPlantilla)
            .filter(Boolean)
    );
    if (sesionesEliminables.length) {
        await Horario.deleteMany({ _id: { $in: sesionesEliminables.map(sesion => sesion._id) } });
    }

    const plantillasProvisionales = await PlantillaHorario.find({
        nombreClase: { $in: CLASES_RETIRADAS },
        vigenteDesde: VIGENTE_DESDE,
    }).select('_id').lean<Array<{ _id: mongoose.Types.ObjectId }>>();
    const plantillasEliminables = plantillasProvisionales.filter(
        plantilla => !idsPlantillasProtegidas.has(plantilla._id.toString())
    );
    if (plantillasEliminables.length) {
        await Promise.all(
            plantillasEliminables.map(plantilla => PlantillaHorario.findByIdAndDelete(plantilla._id))
        );
    }
    if (idsPlantillasProtegidas.size) {
        await PlantillaHorario.updateMany(
            { _id: { $in: [...idsPlantillasProtegidas] } },
            { $set: { estatus: 'inactivo' } }
        );
    }

    const nombresProvisionalesProtegidos = new Set(
        sesionesProvisionales
            .filter(sesion => reservasProtegidas.has(`${sesion.nombreClase}|${sesion.fecha}|${sesion.horaInicio}`))
            .map(sesion => sesion.nombreClase)
    );
    await Clase.deleteMany({
        nombre: { $in: CLASES_RETIRADAS.filter(nombre => !nombresProvisionalesProtegidos.has(nombre)) },
    });
    if (nombresProvisionalesProtegidos.size) {
        await Clase.updateMany(
            { nombre: { $in: [...nombresProvisionalesProtegidos] } },
            { $set: { estatus: 'inactivo' } }
        );
    }

    const reglas = construirReglas();
    const clavesVigentes: string[] = [];
    for (const regla of reglas) {
        const clase = clasesPorNombre.get(regla.clase);
        const entrenador = regla.entrenador ? entrenadoresPorNombre.get(regla.entrenador) : null;
        const clave = `${regla.clase}|${regla.salon}|${regla.diaSemana}|${regla.horaInicio}|${VIGENTE_DESDE}`;
        clavesVigentes.push(clave);
        await PlantillaHorario.findOneAndUpdate(
            { clave },
            {
                $set: {
                    idClase: clase._id.toString(),
                    nombreClase: clase.nombre,
                    entrenadorId: entrenador?._id.toString() ?? '',
                    nombreEntrenador: regla.entrenador ?? 'Sin asignar',
                    diaSemana: regla.diaSemana,
                    horaInicio: regla.horaInicio,
                    horaFin: regla.horaFin,
                    capacidadTotal: regla.capacidadTotal,
                    salon: regla.salon,
                    vigenteDesde: VIGENTE_DESDE,
                    vigenteHasta: '',
                    estatus: 'activo',
                },
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
    }
    await PlantillaHorario.updateMany(
        { clave: { $nin: clavesVigentes }, vigenteDesde: VIGENTE_DESDE },
        { $set: { estatus: 'inactivo' } }
    );

    const generacion = await generarSesionesDesdePlantillas(VIGENTE_DESDE, DIAS_GENERADOS);
    console.log(`Entrenadores activos de la app móvil: ${entrenadores.length}`);
    console.log(`Clases operativas activas: ${catalogo.length}`);
    console.log(`Plantillas semanales activas: ${reglas.length}`);
    console.log(`Sesiones provisionales eliminadas: ${sesionesEliminables.length}`);
    console.log(`Sesiones provisionales protegidas por reservación: ${sesionesProvisionales.length - sesionesEliminables.length}`);
    console.log(`Sesiones creadas: ${generacion.sesionesCreadas}; ya existentes: ${generacion.sesionesExistentes}`);
    console.log(`Ventana generada: ${generacion.desde} a ${generacion.hasta}`);
    await mongoose.disconnect();
}

main().catch(async error => {
    console.error('No se pudo cargar la programación semanal:', error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
});