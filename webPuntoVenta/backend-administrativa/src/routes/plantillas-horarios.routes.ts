import crypto from 'node:crypto';
import { Router } from 'express';
import { Clase } from '../models/Clases/clases';
import { Horario } from '../models/Horarios/horarios';
import { PlantillaHorario } from '../models/PlantillasHorarios/plantillasHorarios';
import { Usuario } from '../models/Usuarios/usuarios';
import { generarSesionesDesdePlantillas } from '../services/generar-sesiones';
import { mantenerHorizonteSesiones } from '../services/mantener-horizonte-sesiones';
import {
    esEnteroPositivo,
    esFechaISO,
    esHoraHHMM,
    esObjectId,
    esTextoNoVacio,
} from '../lib/validacion';

const router = Router();
const DURACION_MINIMA_MINUTOS = 30;
const DIAS_HORIZONTE = 56;
const MAXIMO_DIAS_PROGRAMACION = 366;
const API_RESERVAS = process.env.COBRO_RESERVAS_URL ?? 'http://localhost:3000/cobro/api/reservas';
const CAMPOS_CREACION = [
    'idClase',
    'entrenadorId',
    'salon',
    'fechaInicio',
    'horaInicio',
    'horaFin',
    'diasSemana',
    'fechaFin',
    'visibleReservas',
    'listaEsperaHabilitada',
    'estatus',
];
const CAMPOS_EDICION = [
    'idClase',
    'entrenadorId',
    'horaInicio',
    'horaFin',
    'capacidadTotal',
    'salon',
    'estatus',
    'aplicarDesde',
];
const CAMPOS_EDICION_SERIE = [
    'idClase',
    'entrenadorId',
    'salon',
    'horaInicio',
    'horaFin',
    'diasSemana',
    'aplicarDesde',
    'visibleReservas',
    'listaEsperaHabilitada',
];
const CAMPOS_ACCION_SERIE = ['aplicarDesde'];

interface ReservaCobro {
    class?: string;
    time?: string;
    fecha?: string;
    status?: string;
}

function minutosDeHora(hora: string): number | null {
    if (!esHoraHHMM(hora)) return null;
    const [horas, minutos] = hora.split(':').map(Number);
    return horas * 60 + minutos;
}

/* Revisa que el rango tenga sentido y dure por lo menos media hora. */
function errorIntervalo(horaInicio: string, horaFin: string): string | null {
    const inicio = minutosDeHora(horaInicio);
    const fin = minutosDeHora(horaFin);
    if (inicio === null || fin === null) return 'Las horas de inicio y fin deben tener formato HH:MM.';
    if (fin <= inicio) return 'La hora de fin debe ser posterior a la hora de inicio.';
    if (fin - inicio < DURACION_MINIMA_MINUTOS) {
        return `La duracion del horario debe ser de al menos ${DURACION_MINIMA_MINUTOS} minutos.`;
    }
    return null;
}

function nombreCompleto(usuario: any): string {
    return [usuario?.nombre, usuario?.apellidos]
        .filter(parte => typeof parte === 'string' && parte.trim().length > 0)
        .map(parte => parte.trim())
        .join(' ');
}

function fechaUTC(valor: string): Date {
    return new Date(`${valor}T00:00:00.000Z`);
}

function fechaISO(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
}

function sumarDias(fecha: string, dias: number): string {
    const resultado = fechaUTC(fecha);
    resultado.setUTCDate(resultado.getUTCDate() + dias);
    return fechaISO(resultado);
}

function restarUnDia(fecha: string): string {
    return sumarDias(fecha, -1);
}

function diasEntre(desde: string, hasta: string): number {
    return Math.floor((fechaUTC(hasta).getTime() - fechaUTC(desde).getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

function fechasDeOcurrencias(desde: string, hasta: string, diasSemana: number[]): string[] {
    const dias = new Set(diasSemana);
    const fechas: string[] = [];
    for (let cursor = fechaUTC(desde); cursor <= fechaUTC(hasta); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        if (dias.has(cursor.getUTCDay())) fechas.push(fechaISO(cursor));
    }
    return fechas;
}

/*
 * Cobro relaciona la reserva por clase + fecha + hora. Armamos esa misma
 * llave para saber que sesiones no debemos mover.
 */
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
                .filter(reserva => (
                    reserva.fecha &&
                    reserva.class &&
                    reserva.time &&
                    reserva.status !== 'cancelado' &&
                    reserva.status !== 'cancelada'
                ))
                .map(reserva => `${reserva.class}|${reserva.fecha}|${reserva.time}`)
        );
    } catch (error) {
        throw new Error(
            `No se pudieron comprobar las reservaciones en ${API_RESERVAS}; no se hizo ningun cambio. ${error}`
        );
    } finally {
        clearTimeout(timeout);
    }
}

function resumenProtegidas(sesiones: any[]) {
    return sesiones.map(sesion => ({
        idHorario: sesion._id.toString(),
        fecha: sesion.fecha,
        clase: sesion.nombreClase,
        horaInicio: sesion.horaInicio,
    }));
}

async function obtenerSerie(serieId: string) {
    if (!esTextoNoVacio(serieId)) return [];
    const serie = await PlantillaHorario.find({ serieId }).sort({ vigenteDesde: 1, diaSemana: 1 });
    if (serie.length || !esObjectId(serieId)) return serie;
    const plantilla = await PlantillaHorario.findById(serieId);
    return plantilla ? [plantilla] : [];
}

function validarAplicarDesde(valor: unknown): string | null {
    if (!esFechaISO(valor)) return 'La fecha de aplicacion debe tener formato YYYY-MM-DD.';
    const hoy = new Date().toISOString().slice(0, 10);
    if (String(valor) < hoy) return 'La fecha de aplicacion no puede estar en el pasado.';
    return null;
}

router.get('/', async (_req, res) => {
    const plantillas = await PlantillaHorario.find().sort({ salon: 1, diaSemana: 1, horaInicio: 1 });
    res.json(plantillas);
});

/*
 * Crea una serie semanal a partir de una clase existente. El modelo conserva
 * una plantilla por dia para seguir siendo compatible con la edicion actual,
 * pero todas comparten serieId y se crean en una sola operacion.
 */
router.post('/', async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'El cuerpo de la peticion debe ser un objeto JSON.' });
    }
    const camposDesconocidos = Object.keys(req.body).filter(campo => !CAMPOS_CREACION.includes(campo));
    if (camposDesconocidos.length) {
        return res.status(400).json({ error: `Campo no permitido: ${camposDesconocidos[0]}.` });
    }

    const {
        idClase,
        entrenadorId,
        salon,
        fechaInicio,
        horaInicio,
        horaFin,
        diasSemana,
        fechaFin = '',
        visibleReservas = true,
        listaEsperaHabilitada = false,
        estatus = 'activo',
    } = req.body;

    if (!esObjectId(idClase)) return res.status(400).json({ error: 'Selecciona una clase valida.' });
    if (!esObjectId(entrenadorId)) return res.status(400).json({ error: 'Selecciona un instructor valido.' });
    if (!esTextoNoVacio(salon)) return res.status(400).json({ error: 'La sala es obligatoria.' });
    if (!esFechaISO(fechaInicio)) {
        return res.status(400).json({ error: 'La fecha de inicio debe tener formato YYYY-MM-DD.' });
    }
    const hoy = new Date().toISOString().slice(0, 10);
    if (fechaInicio < hoy) {
        return res.status(400).json({ error: 'La fecha de inicio no puede estar en el pasado.' });
    }
    if (fechaFin !== '' && !esFechaISO(fechaFin)) {
        return res.status(400).json({ error: 'La fecha final debe estar vacia o tener formato YYYY-MM-DD.' });
    }
    if (fechaFin && fechaFin < fechaInicio) {
        return res.status(400).json({ error: 'La fecha final no puede ser anterior a la fecha de inicio.' });
    }
    if (fechaFin && diasEntre(fechaInicio, fechaFin) > MAXIMO_DIAS_PROGRAMACION) {
        return res.status(400).json({ error: `La programacion no puede superar ${MAXIMO_DIAS_PROGRAMACION} dias.` });
    }
    const intervaloInvalido = errorIntervalo(horaInicio, horaFin);
    if (intervaloInvalido) return res.status(400).json({ error: intervaloInvalido });
    if (!Array.isArray(diasSemana) || diasSemana.length === 0) {
        return res.status(400).json({ error: 'Selecciona al menos un dia de la semana.' });
    }
    if (diasSemana.some(dia => !Number.isInteger(dia) || dia < 0 || dia > 6)) {
        return res.status(400).json({ error: 'Los dias de la semana deben ser numeros enteros del 0 al 6.' });
    }
    if (new Set(diasSemana).size !== diasSemana.length) {
        return res.status(400).json({ error: 'No repitas dias de la semana.' });
    }
    if (typeof visibleReservas !== 'boolean') {
        return res.status(400).json({ error: 'La visibilidad para reservaciones debe ser verdadera o falsa.' });
    }
    if (typeof listaEsperaHabilitada !== 'boolean') {
        return res.status(400).json({ error: 'La configuracion de lista de espera debe ser verdadera o falsa.' });
    }
    if (estatus !== 'activo' && estatus !== 'inactivo') {
        return res.status(400).json({ error: "El estatus debe ser 'activo' o 'inactivo'." });
    }

    const clase: any = await Clase.findById(idClase);
    if (!clase || clase.estatus !== 'activo') {
        return res.status(404).json({ error: 'La clase seleccionada no existe o esta inactiva.' });
    }
    if (!esEnteroPositivo(clase.capacidad)) {
        return res.status(409).json({ error: 'La clase no tiene una capacidad valida configurada.' });
    }
    const entrenador: any = await Usuario.findById(entrenadorId);
    if (!entrenador) return res.status(404).json({ error: 'El instructor seleccionado no existe.' });
    if (entrenador.rol !== 'entrenador' || entrenador.estatus !== 'activo') {
        return res.status(400).json({ error: 'El usuario seleccionado no es un instructor activo.' });
    }
    const nombreEntrenador = nombreCompleto(entrenador);
    if (!esTextoNoVacio(nombreEntrenador)) {
        return res.status(400).json({ error: 'El instructor seleccionado no tiene nombre registrado.' });
    }

    const salonFinal = salon.trim();
    const diasOrdenados = [...diasSemana].map(Number).sort((a, b) => a - b);
    const hastaGeneracion = fechaFin || sumarDias(fechaInicio, DIAS_HORIZONTE - 1);
    const fechas = fechasDeOcurrencias(fechaInicio, hastaGeneracion, diasOrdenados);
    if (!fechas.length) {
        return res.status(400).json({ error: 'Los dias seleccionados no producen sesiones dentro del rango indicado.' });
    }

    if (estatus === 'activo') {
        const vigenciaCompatible = {
            vigenteDesde: { $lte: hastaGeneracion },
            $or: [{ vigenteHasta: '' }, { vigenteHasta: { $gte: fechaInicio } }],
        };
        const cruceSala = await PlantillaHorario.findOne({
            estatus: 'activo',
            diaSemana: { $in: diasOrdenados },
            salon: salonFinal,
            horaInicio: { $lt: horaFin },
            horaFin: { $gt: horaInicio },
            ...vigenciaCompatible,
        }).select('diaSemana horaInicio horaFin');
        if (cruceSala) {
            return res.status(409).json({ error: 'Ya existe otra clase en esa sala y horario semanal.' });
        }
        const cruceEntrenador = await PlantillaHorario.findOne({
            estatus: 'activo',
            diaSemana: { $in: diasOrdenados },
            entrenadorId,
            horaInicio: { $lt: horaFin },
            horaFin: { $gt: horaInicio },
            ...vigenciaCompatible,
        }).select('diaSemana horaInicio horaFin');
        if (cruceEntrenador) {
            return res.status(409).json({ error: 'El instructor ya tiene otra clase en ese horario semanal.' });
        }

        const cruceSalaFechado = await Horario.findOne({
            estatus: 'activo',
            fecha: { $in: fechas },
            salon: salonFinal,
            horaInicio: { $lt: horaFin },
            horaFin: { $gt: horaInicio },
        }).select('fecha horaInicio horaFin');
        if (cruceSalaFechado) {
            return res.status(409).json({
                error: `Ya existe otra sesion en ${salonFinal} el ${cruceSalaFechado.fecha} de ${cruceSalaFechado.horaInicio} a ${cruceSalaFechado.horaFin}.`,
            });
        }
        const cruceEntrenadorFechado = await Horario.findOne({
            estatus: 'activo',
            fecha: { $in: fechas },
            entrenadorId,
            horaInicio: { $lt: horaFin },
            horaFin: { $gt: horaInicio },
        }).select('fecha horaInicio horaFin');
        if (cruceEntrenadorFechado) {
            return res.status(409).json({
                error: `El instructor ya tiene otra sesion el ${cruceEntrenadorFechado.fecha} de ${cruceEntrenadorFechado.horaInicio} a ${cruceEntrenadorFechado.horaFin}.`,
            });
        }
    }

    const serieId = crypto.randomUUID();
    let idsPlantillas: string[] = [];
    try {
        const plantillas: any[] = await (PlantillaHorario as any).create(diasOrdenados.map(diaSemana => ({
            clave: `${serieId}|${diaSemana}`,
            serieId,
            idClase: clase._id.toString(),
            nombreClase: clase.nombre,
            entrenadorId: entrenador._id.toString(),
            nombreEntrenador,
            diaSemana,
            horaInicio,
            horaFin,
            capacidadTotal: Number(clase.capacidad),
            salon: salonFinal,
            vigenteDesde: fechaInicio,
            vigenteHasta: fechaFin,
            visibleReservas,
            listaEsperaHabilitada,
            estatus,
        })));
        idsPlantillas = plantillas.map(plantilla => plantilla._id.toString());
        const generacion = estatus === 'activo'
            ? await generarSesionesDesdePlantillas(fechaInicio, diasEntre(fechaInicio, hastaGeneracion), idsPlantillas)
            : {
                desde: fechaInicio,
                hasta: hastaGeneracion,
                plantillasActivas: 0,
                sesionesCreadas: 0,
                sesionesExistentes: 0,
            };

        return res.status(201).json({
            mensaje: 'La programacion semanal fue creada correctamente.',
            serieId,
            capacidadHeredada: Number(clase.capacidad),
            plantillas,
            generacion,
        });
    } catch (error) {
        if (idsPlantillas.length) {
            await Horario.deleteMany({ idPlantilla: { $in: idsPlantillas } }).catch(() => undefined);
            await PlantillaHorario.deleteMany({ _id: { $in: idsPlantillas } }).catch(() => undefined);
        } else {
            await PlantillaHorario.deleteMany({ serieId }).catch(() => undefined);
        }
        throw error;
    }
});

/*
 * Versiona una serie completa desde una fecha. Las plantillas anteriores
 * conservan su vigencia historica y las sesiones reservadas quedan como
 * excepciones inmutables; las libres se reemplazan por la nueva version.
 */
router.patch('/series/:serieId', async (req, res) => {
    const identificadorSerie = req.params.serieId?.trim();
    const serie: any[] = await obtenerSerie(identificadorSerie);
    if (!serie.length) return res.status(404).json({ error: 'Programacion semanal no encontrada.' });
    const serieId = String(serie[0].serieId || identificadorSerie);
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Envia los cambios de la programacion semanal.' });
    }
    const camposDesconocidos = Object.keys(req.body).filter(campo => !CAMPOS_EDICION_SERIE.includes(campo));
    if (camposDesconocidos.length) {
        return res.status(400).json({ error: `Campo no permitido: ${camposDesconocidos[0]}.` });
    }

    const base = [...serie].reverse().find(item => item.estatus === 'activo') ?? serie[serie.length - 1];
    const aplicarDesde = String(req.body.aplicarDesde ?? '');
    const errorFecha = validarAplicarDesde(aplicarDesde);
    if (errorFecha) return res.status(400).json({ error: errorFecha });

    const idClase = String(req.body.idClase ?? base.idClase);
    const entrenadorId = String(req.body.entrenadorId ?? base.entrenadorId ?? '');
    const salon = String(req.body.salon ?? base.salon).trim();
    const horaInicio = String(req.body.horaInicio ?? base.horaInicio);
    const horaFin = String(req.body.horaFin ?? base.horaFin);
    const diasSemana = req.body.diasSemana ?? [...new Set(serie.filter(item => item.estatus === 'activo').map(item => item.diaSemana))];
    const visibleReservas = req.body.visibleReservas ?? base.visibleReservas ?? true;
    const listaEsperaHabilitada = req.body.listaEsperaHabilitada ?? base.listaEsperaHabilitada ?? false;

    if (!esObjectId(idClase)) return res.status(400).json({ error: 'Selecciona una clase valida.' });
    if (!esObjectId(entrenadorId)) return res.status(400).json({ error: 'Selecciona un instructor valido.' });
    if (!esTextoNoVacio(salon)) return res.status(400).json({ error: 'La sala es obligatoria.' });
    const intervaloInvalido = errorIntervalo(horaInicio, horaFin);
    if (intervaloInvalido) return res.status(400).json({ error: intervaloInvalido });
    if (!Array.isArray(diasSemana) || !diasSemana.length) {
        return res.status(400).json({ error: 'Selecciona al menos un dia de la semana.' });
    }
    if (diasSemana.some(dia => !Number.isInteger(dia) || dia < 0 || dia > 6)) {
        return res.status(400).json({ error: 'Los dias de la semana deben ser numeros enteros del 0 al 6.' });
    }
    if (new Set(diasSemana).size !== diasSemana.length) {
        return res.status(400).json({ error: 'No repitas dias de la semana.' });
    }
    if (typeof visibleReservas !== 'boolean' || typeof listaEsperaHabilitada !== 'boolean') {
        return res.status(400).json({ error: 'La configuracion de reservaciones debe ser verdadera o falsa.' });
    }

    const clase: any = await Clase.findById(idClase);
    if (!clase || clase.estatus !== 'activo') {
        return res.status(404).json({ error: 'La clase seleccionada no existe o esta inactiva.' });
    }
    if (!esEnteroPositivo(clase.capacidad)) {
        return res.status(409).json({ error: 'La clase no tiene una capacidad valida configurada.' });
    }
    const entrenador: any = await Usuario.findById(entrenadorId);
    if (!entrenador || entrenador.rol !== 'entrenador' || entrenador.estatus !== 'activo') {
        return res.status(400).json({ error: 'El usuario seleccionado no es un instructor activo.' });
    }
    const nombreEntrenador = nombreCompleto(entrenador);
    if (!esTextoNoVacio(nombreEntrenador)) {
        return res.status(400).json({ error: 'El instructor seleccionado no tiene nombre registrado.' });
    }

    const serieAbierta = serie.some(item => !item.vigenteHasta);
    const finales = serie.map(item => item.vigenteHasta).filter((fecha): fecha is string => esFechaISO(fecha));
    const limiteGeneracion = serieAbierta ? sumarDias(aplicarDesde, DIAS_HORIZONTE - 1) : finales.sort().at(-1)!;
    const vigenteHastaNueva = serieAbierta ? '' : limiteGeneracion;
    if (!limiteGeneracion || limiteGeneracion < aplicarDesde) {
        return res.status(400).json({ error: 'La programacion ya termino antes de la fecha de aplicacion.' });
    }
    const diasOrdenados = [...diasSemana].map(Number).sort((a, b) => a - b);
    const fechas = fechasDeOcurrencias(aplicarDesde, limiteGeneracion, diasOrdenados);
    if (!fechas.length) {
        return res.status(400).json({ error: 'Los dias seleccionados no producen sesiones dentro del rango indicado.' });
    }

    const idsSerie = serie.map(item => item._id.toString());
    const vigenciaCompatible = {
        vigenteDesde: { $lte: limiteGeneracion },
        $or: [{ vigenteHasta: '' }, { vigenteHasta: { $gte: aplicarDesde } }],
    };
    const cruceSala = await PlantillaHorario.findOne({
        _id: { $nin: idsSerie },
        estatus: 'activo',
        diaSemana: { $in: diasOrdenados },
        salon,
        horaInicio: { $lt: horaFin },
        horaFin: { $gt: horaInicio },
        ...vigenciaCompatible,
    }).select('diaSemana horaInicio horaFin');
    if (cruceSala) return res.status(409).json({ error: 'Ya existe otra clase en esa sala y horario semanal.' });
    const cruceEntrenador = await PlantillaHorario.findOne({
        _id: { $nin: idsSerie },
        estatus: 'activo',
        diaSemana: { $in: diasOrdenados },
        entrenadorId,
        horaInicio: { $lt: horaFin },
        horaFin: { $gt: horaInicio },
        ...vigenciaCompatible,
    }).select('diaSemana horaInicio horaFin');
    if (cruceEntrenador) return res.status(409).json({ error: 'El instructor ya tiene otra clase en ese horario semanal.' });

    const sesionesSerie: any[] = await Horario.find({ idPlantilla: { $in: idsSerie }, fecha: { $gte: aplicarDesde } });
    let reservasProtegidas: Set<string>;
    try {
        reservasProtegidas = await obtenerReservasProtegidas();
    } catch (error) {
        return res.status(503).json({ error: error instanceof Error ? error.message : 'No se pudieron comprobar las reservaciones.' });
    }
    const sesionesProtegidas = sesionesSerie.filter(sesion => (
        sesion.esExcepcionPlantilla ||
        reservasProtegidas.has(`${sesion.nombreClase}|${sesion.fecha}|${sesion.horaInicio}`)
    ));
    const idsProtegidos = new Set(sesionesProtegidas.map(sesion => sesion._id.toString()));
    const sesionesLibres = sesionesSerie.filter(sesion => !idsProtegidos.has(sesion._id.toString()));

    const cruceSalaFechado = await Horario.findOne({
        idPlantilla: { $nin: idsSerie },
        estatus: 'activo',
        fecha: { $in: fechas },
        salon,
        horaInicio: { $lt: horaFin },
        horaFin: { $gt: horaInicio },
    }).select('fecha horaInicio horaFin');
    if (cruceSalaFechado) {
        return res.status(409).json({ error: `Ya existe otra sesion en ${salon} el ${cruceSalaFechado.fecha} de ${cruceSalaFechado.horaInicio} a ${cruceSalaFechado.horaFin}.` });
    }
    const cruceEntrenadorFechado = await Horario.findOne({
        idPlantilla: { $nin: idsSerie },
        estatus: 'activo',
        fecha: { $in: fechas },
        entrenadorId,
        horaInicio: { $lt: horaFin },
        horaFin: { $gt: horaInicio },
    }).select('fecha horaInicio horaFin');
    if (cruceEntrenadorFechado) {
        return res.status(409).json({ error: `El instructor ya tiene otra sesion el ${cruceEntrenadorFechado.fecha} de ${cruceEntrenadorFechado.horaInicio} a ${cruceEntrenadorFechado.horaFin}.` });
    }

    const versionId = crypto.randomUUID();
    let nuevasPlantillas: any[] = [];
    try {
        nuevasPlantillas = await (PlantillaHorario as any).create(diasOrdenados.map(diaSemana => ({
            clave: `${serieId}|${versionId}|${diaSemana}`,
            serieId,
            idClase: clase._id.toString(),
            nombreClase: clase.nombre,
            entrenadorId: entrenador._id.toString(),
            nombreEntrenador,
            diaSemana,
            horaInicio,
            horaFin,
            capacidadTotal: Number(clase.capacidad),
            salon,
            vigenteDesde: aplicarDesde,
            vigenteHasta: vigenteHastaNueva,
            visibleReservas,
            listaEsperaHabilitada,
            estatus: 'activo',
        })));
        const idsNuevas = nuevasPlantillas.map(item => item._id.toString());
        const generacionBase = await generarSesionesDesdePlantillas(aplicarDesde, diasEntre(aplicarDesde, limiteGeneracion), idsNuevas);

        const fechasProtegidas = [...new Set(sesionesProtegidas.map(sesion => sesion.fecha))];
        const duplicadasProtegidas = fechasProtegidas.length
            ? await Horario.deleteMany({ idPlantilla: { $in: idsNuevas }, fecha: { $in: fechasProtegidas } })
            : { deletedCount: 0 };

        const finAnterior = restarUnDia(aplicarDesde);
        await PlantillaHorario.updateMany(
            { _id: { $in: serie.map(item => item._id) }, vigenteDesde: { $lt: aplicarDesde }, $or: [{ vigenteHasta: '' }, { vigenteHasta: { $gte: aplicarDesde } }] },
            { $set: { vigenteHasta: finAnterior, estatus: 'inactivo' } },
        );
        await PlantillaHorario.updateMany(
            { _id: { $in: serie.map(item => item._id) }, vigenteDesde: { $gte: aplicarDesde } },
            { $set: { estatus: 'inactivo' } },
        );
        if (sesionesLibres.length) {
            await Horario.deleteMany({ _id: { $in: sesionesLibres.map(sesion => sesion._id) } });
        }

        const sesionesCreadas = Math.max(0, generacionBase.sesionesCreadas - Number(duplicadasProtegidas.deletedCount ?? 0));
        return res.json({
            mensaje: sesionesProtegidas.length
                ? 'La programacion semanal fue actualizada. Las sesiones protegidas o marcadas como excepcion conservaron sus datos anteriores.'
                : 'La programacion semanal fue actualizada correctamente.',
            serieId,
            plantillas: nuevasPlantillas,
            sesionesEliminadas: sesionesLibres.length,
            sesionesCreadas,
            sesionesProtegidas: sesionesProtegidas.length,
            protegidas: resumenProtegidas(sesionesProtegidas),
        });
    } catch (error) {
        const idsNuevas = nuevasPlantillas.map(item => item._id.toString());
        if (idsNuevas.length) {
            await Horario.deleteMany({ idPlantilla: { $in: idsNuevas } }).catch(() => undefined);
            await PlantillaHorario.deleteMany({ _id: { $in: nuevasPlantillas.map(item => item._id) } }).catch(() => undefined);
        }
        throw error;
    }
});

async function cerrarSerie(req: any, res: any, eliminar: boolean) {
    const identificadorSerie = req.params.serieId?.trim();
    const serie: any[] = await obtenerSerie(identificadorSerie);
    if (!serie.length) return res.status(404).json({ error: 'Programacion semanal no encontrada.' });
    const serieId = String(serie[0].serieId || identificadorSerie);
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Indica desde que fecha aplicar la operacion.' });
    }
    const camposDesconocidos = Object.keys(req.body).filter(campo => !CAMPOS_ACCION_SERIE.includes(campo));
    if (camposDesconocidos.length) return res.status(400).json({ error: `Campo no permitido: ${camposDesconocidos[0]}.` });
    const aplicarDesde = String(req.body.aplicarDesde ?? '');
    const errorFecha = validarAplicarDesde(aplicarDesde);
    if (errorFecha) return res.status(400).json({ error: errorFecha });

    let reservasProtegidas: Set<string>;
    try {
        reservasProtegidas = await obtenerReservasProtegidas();
    } catch (error) {
        return res.status(503).json({ error: error instanceof Error ? error.message : 'No se pudieron comprobar las reservaciones.' });
    }
    const idsSerie = serie.map(item => item._id.toString());
    const sesiones: any[] = await Horario.find({ idPlantilla: { $in: idsSerie }, fecha: { $gte: aplicarDesde } });
    const protegidas = sesiones.filter(sesion => (
        sesion.esExcepcionPlantilla ||
        reservasProtegidas.has(`${sesion.nombreClase}|${sesion.fecha}|${sesion.horaInicio}`)
    ));
    const idsProtegidos = new Set(protegidas.map(sesion => sesion._id.toString()));
    const libres = sesiones.filter(sesion => !idsProtegidos.has(sesion._id.toString()));

    const finAnterior = restarUnDia(aplicarDesde);
    await PlantillaHorario.updateMany(
        { _id: { $in: serie.map(item => item._id) }, vigenteDesde: { $lt: aplicarDesde }, $or: [{ vigenteHasta: '' }, { vigenteHasta: { $gte: aplicarDesde } }] },
        { $set: { vigenteHasta: finAnterior, estatus: 'inactivo' } },
    );
    await PlantillaHorario.updateMany(
        { _id: { $in: serie.map(item => item._id) }, vigenteDesde: { $gte: aplicarDesde } },
        { $set: { estatus: 'inactivo' } },
    );
    if (libres.length) {
        if (eliminar) await Horario.deleteMany({ _id: { $in: libres.map(sesion => sesion._id) } });
        else await Horario.updateMany({ _id: { $in: libres.map(sesion => sesion._id) } }, { $set: { estatus: 'inactivo' } });
    }
    return res.json({
        mensaje: eliminar ? 'La programacion futura fue eliminada.' : 'La programacion semanal fue desactivada.',
        serieId,
        sesionesDesactivadas: eliminar ? 0 : libres.length,
        sesionesEliminadas: eliminar ? libres.length : 0,
        sesionesProtegidas: protegidas.length,
        protegidas: resumenProtegidas(protegidas),
    });
}

router.post('/series/:serieId/desactivar', async (req, res) => cerrarSerie(req, res, false));
router.delete('/series/:serieId/futuro', async (req, res) => cerrarSerie(req, res, true));

/*
 * Edita una regla semanal y pasa el cambio a sus sesiones futuras libres.
 * Las sesiones reservadas se quedan igual para respetar lo que aparto el cliente.
 */
router.patch('/:id', async (req, res) => {
    if (!esObjectId(req.params.id)) {
        return res.status(400).json({ error: 'El identificador de la plantilla no es valido.' });
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Envia los cambios de la plantilla.' });
    }
    const camposDesconocidos = Object.keys(req.body).filter(campo => !CAMPOS_EDICION.includes(campo));
    if (camposDesconocidos.length) {
        return res.status(400).json({ error: `Campo no permitido: ${camposDesconocidos[0]}.` });
    }
    const camposCambio = Object.keys(req.body).filter(campo => campo !== 'aplicarDesde');
    if (!camposCambio.length) {
        return res.status(400).json({ error: 'Envia al menos un cambio para la semana.' });
    }

    const aplicarDesde = req.body.aplicarDesde;
    if (!esFechaISO(aplicarDesde)) {
        return res.status(400).json({ error: 'La fecha de aplicacion debe tener formato YYYY-MM-DD.' });
    }
    const hoy = new Date().toISOString().slice(0, 10);
    if (aplicarDesde < hoy) {
        return res.status(400).json({ error: 'La fecha de aplicacion no puede estar en el pasado.' });
    }

    const plantilla: any = await PlantillaHorario.findById(req.params.id);
    if (!plantilla) return res.status(404).json({ error: 'Plantilla semanal no encontrada.' });

    const idClase = String(req.body.idClase ?? plantilla.idClase);
    const entrenadorId = String(req.body.entrenadorId ?? plantilla.entrenadorId ?? '');
    const horaInicio = String(req.body.horaInicio ?? plantilla.horaInicio);
    const horaFin = String(req.body.horaFin ?? plantilla.horaFin);
    const salon = String(req.body.salon ?? plantilla.salon).trim();
    const capacidadTotal = Number(req.body.capacidadTotal ?? plantilla.capacidadTotal);
    const estatus = String(req.body.estatus ?? plantilla.estatus);

    if (!esObjectId(idClase)) return res.status(400).json({ error: 'Selecciona una clase valida.' });
    if (entrenadorId && !esObjectId(entrenadorId)) {
        return res.status(400).json({ error: 'Selecciona un entrenador valido.' });
    }
    if (!esTextoNoVacio(salon)) return res.status(400).json({ error: 'La sala es obligatoria.' });
    if (!esEnteroPositivo(capacidadTotal)) {
        return res.status(400).json({ error: 'La capacidad debe ser un numero entero mayor que cero.' });
    }
    if (estatus !== 'activo' && estatus !== 'inactivo') {
        return res.status(400).json({ error: "El estatus debe ser 'activo' o 'inactivo'." });
    }
    const intervaloInvalido = errorIntervalo(horaInicio, horaFin);
    if (intervaloInvalido) return res.status(400).json({ error: intervaloInvalido });

    /* Los nombres siempre salen de la base, no de lo que mande el navegador. */
    const clase = await Clase.findById(idClase);
    if (!clase || clase.estatus !== 'activo') {
        return res.status(404).json({ error: 'La clase seleccionada no existe o esta inactiva.' });
    }
    if (capacidadTotal > clase.capacidad) {
        return res.status(409).json({
            error: `La capacidad no puede superar los ${clase.capacidad} lugares de la clase.`,
        });
    }

    let nombreEntrenador = 'Sin asignar';
    if (entrenadorId) {
        const entrenador: any = await Usuario.findById(entrenadorId);
        if (!entrenador) return res.status(404).json({ error: 'El entrenador seleccionado no existe.' });
        if (entrenador.rol !== 'entrenador' || entrenador.estatus !== 'activo') {
            return res.status(400).json({ error: 'El usuario seleccionado no es un entrenador activo.' });
        }
        nombreEntrenador = nombreCompleto(entrenador);
    }

    /* Primero revisamos cruces contra las otras reglas de la semana. */
    if (estatus === 'activo') {
        const filtroCruceSala: Record<string, unknown> = {
            _id: { $ne: plantilla._id },
            estatus: 'activo',
            diaSemana: plantilla.diaSemana,
            salon,
            horaInicio: { $lt: horaFin },
            horaFin: { $gt: horaInicio },
        };
        const cruceSala = await (PlantillaHorario as any).findOne(filtroCruceSala).select('_id');
        if (cruceSala) {
            return res.status(409).json({ error: 'Ya existe otra clase en esa sala y en ese horario semanal.' });
        }

        if (entrenadorId) {
            const filtroCruceEntrenador: Record<string, unknown> = {
                _id: { $ne: plantilla._id },
                estatus: 'activo',
                diaSemana: plantilla.diaSemana,
                entrenadorId,
                horaInicio: { $lt: horaFin },
                horaFin: { $gt: horaInicio },
            };
            const cruceEntrenador = await (PlantillaHorario as any).findOne(filtroCruceEntrenador).select('_id');
            if (cruceEntrenador) {
                return res.status(409).json({ error: 'El entrenador ya tiene otra clase en ese horario semanal.' });
            }
        }
    }

    let reservasProtegidas: Set<string>;
    try {
        /* Si Cobro no responde, paramos aqui antes de tocar MongoDB. */
        reservasProtegidas = await obtenerReservasProtegidas();
    } catch (error) {
        return res.status(503).json({
            error: error instanceof Error ? error.message : 'No se pudieron comprobar las reservaciones.',
        });
    }

    const sesionesFuturas = await Horario.find({
        idPlantilla: plantilla._id.toString(),
        fecha: { $gte: aplicarDesde },
    });
    const sesionesProtegidas = sesionesFuturas.filter(sesion => (
        sesion.esExcepcionPlantilla ||
        reservasProtegidas.has(`${sesion.nombreClase}|${sesion.fecha}|${sesion.horaInicio}`)
    ));
    const idsProtegidos = new Set(sesionesProtegidas.map(sesion => sesion._id.toString()));
    const sesionesEditables = sesionesFuturas.filter(sesion => !idsProtegidos.has(sesion._id.toString()));

    /* Revisamos fechas reales para no chocar con una sesion manual. */
    if (estatus === 'activo' && sesionesEditables.length) {
        const fechas = [...new Set(sesionesEditables.map(sesion => sesion.fecha))];
        const idsEditables = sesionesEditables.map(sesion => sesion._id);
        const cruceSalaFechado = await Horario.findOne({
            _id: { $nin: idsEditables },
            estatus: 'activo',
            fecha: { $in: fechas },
            salon,
            horaInicio: { $lt: horaFin },
            horaFin: { $gt: horaInicio },
        }).select('fecha horaInicio horaFin');
        if (cruceSalaFechado) {
            return res.status(409).json({
                error: `Ya existe otra sesion en ${salon} el ${cruceSalaFechado.fecha} de ${cruceSalaFechado.horaInicio} a ${cruceSalaFechado.horaFin}.`,
            });
        }

        if (entrenadorId) {
            const cruceEntrenadorFechado = await Horario.findOne({
                _id: { $nin: idsEditables },
                estatus: 'activo',
                fecha: { $in: fechas },
                entrenadorId,
                horaInicio: { $lt: horaFin },
                horaFin: { $gt: horaInicio },
            }).select('fecha horaInicio horaFin');
            if (cruceEntrenadorFechado) {
                return res.status(409).json({
                    error: `El entrenador ya tiene otra sesion el ${cruceEntrenadorFechado.fecha} de ${cruceEntrenadorFechado.horaInicio} a ${cruceEntrenadorFechado.horaFin}.`,
                });
            }
        }
    }

    plantilla.idClase = clase._id.toString();
    plantilla.nombreClase = clase.nombre;
    plantilla.entrenadorId = entrenadorId;
    plantilla.nombreEntrenador = nombreEntrenador;
    plantilla.horaInicio = horaInicio;
    plantilla.horaFin = horaFin;
    plantilla.capacidadTotal = capacidadTotal;
    plantilla.salon = salon;
    plantilla.estatus = estatus as 'activo' | 'inactivo';
    await plantilla.save();

    if (sesionesEditables.length) {
        await Horario.updateMany(
            { _id: { $in: sesionesEditables.map(sesion => sesion._id) } },
            {
                $set: {
                    idClase: clase._id.toString(),
                    nombreClase: clase.nombre,
                    entrenadorId,
                    nombreEntrenador,
                    horaInicio,
                    horaFin,
                    capacidadTotal,
                    capacidadDisponible: capacidadTotal,
                    salon,
                    estatus,
                },
            }
        );
    }

    res.json({
        mensaje: sesionesProtegidas.length
            ? 'La semana fue actualizada. Las sesiones con reservaciones conservaron sus datos anteriores.'
            : 'La semana fue actualizada correctamente.',
        plantilla,
        sesionesActualizadas: sesionesEditables.length,
        sesionesProtegidas: sesionesProtegidas.length,
        protegidas: sesionesProtegidas.map(sesion => ({
            idHorario: sesion._id.toString(),
            fecha: sesion.fecha,
            clase: sesion.nombreClase,
            horaInicio: sesion.horaInicio,
        })),
    });
});

router.post('/generar', async (req, res) => {
    const desde = req.body?.desde;
    const dias = Number(req.body?.dias ?? 90);
    if (!esFechaISO(desde)) {
        return res.status(400).json({ error: 'La fecha desde debe tener formato YYYY-MM-DD.' });
    }
    if (!Number.isInteger(dias) || dias < 1 || dias > 366) {
        return res.status(400).json({ error: 'La ventana debe ser de 1 a 366 dias.' });
    }
    res.json(await generarSesionesDesdePlantillas(desde, dias));
});

router.post('/mantener-horizonte', async (_req, res) => {
    res.json(await mantenerHorizonteSesiones({ forzar: true }));
});

export default router;