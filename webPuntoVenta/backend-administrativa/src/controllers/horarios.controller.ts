import type { Request, Response } from 'express';
import { Horario } from '../models/Horarios/horarios';
import { Clase } from '../models/Clases/clases';
import { Usuario } from '../models/Usuarios/usuarios';
import {
    esEnteroPositivo,
    esFechaISO,
    esObjectId,
    esTextoNoVacio,
} from '../lib/validacion';
import { mantenerHorizonteSesiones } from '../services/mantener-horizonte-sesiones';
import { errorIntervaloHorario, nombreCompletoUsuario } from '../services/validacion-horarios';


/*
 * Unicas columnas que se pueden crear o editar en un horario. Sirve para
 * ignorar lo que mande el navegador (por ejemplo _id o capacidadDisponible) y
 * para avisar cuando llega un campo que no existe.
 */
const CAMPOS_PERMITIDOS = [
    'idClase',
    'nombreClase',
    'entrenadorId',
    'nombreEntrenador',
    'fecha',
    'horaInicio',
    'horaFin',
    'capacidadTotal',
    'salon',
    'estatus',
    'visibleReservas',
    'listaEsperaHabilitada',
];
const CAMPOS_EXCEPCION = [
    'entrenadorId',
    'salon',
    'horaInicio',
    'horaFin',
    'estatus',
    'visibleReservas',
    'listaEsperaHabilitada',
];

// GET /api/horarios?fecha=YYYY-MM-DD&estatus=activo

export const listarHorarios = async (req: Request, res: Response) => {
    const { fecha, estatus } = req.query;

    // Los filtros mal formados se rechazan: si no, un "fecha=ayer" simplemente
    // no devuelve nada y parece que no hay horarios.
    if (fecha !== undefined && !esFechaISO(fecha)) {
        return res.status(400).json({ error: 'La fecha debe tener formato YYYY-MM-DD.' });
    }
    if (estatus !== undefined && estatus !== 'activo' && estatus !== 'inactivo') {
        return res.status(400).json({ error: "El estatus debe ser 'activo' o 'inactivo'." });
    }

    // Recupera automaticamente el extremo del horizonte si el servidor estuvo
    // apagado. El listado sigue disponible si este mantenimiento temporalmente
    // falla; el programador volvera a intentarlo.
    await mantenerHorizonteSesiones().catch(error => {
        console.error('[Horizonte movil:consulta] No se pudieron extender las sesiones:', error);
    });

    const filtro: Record<string, unknown> = {};
    if (fecha) filtro.fecha = fecha;
    if (estatus) filtro.estatus = estatus;

    const horarios = await Horario.find(filtro).sort({ fecha: 1, horaInicio: 1 });
    res.json(horarios);
};

export const listarHorariosReservables = async (req: Request, res: Response) => {
    const { fecha } = req.query;
    if (fecha !== undefined && !esFechaISO(fecha)) {
        return res.status(400).json({ error: 'La fecha debe tener formato YYYY-MM-DD.' });
    }

    await mantenerHorizonteSesiones();
    const filtro: Record<string, unknown> = {
        estatus: 'activo',
        visibleReservas: { $ne: false },
    };
    if (fecha) filtro.fecha = fecha;

    const horarios = await Horario.find(filtro).sort({ fecha: 1, horaInicio: 1 });
    res.json(horarios);
};

export const crearHorario = async (req: Request, res: Response) => {
    // El cuerpo tiene que ser un objeto JSON: si el navegador manda otra cosa
    // (o nada), no hay nada que validar y se responde con un 400 claro.
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'El cuerpo de la peticion debe ser un objeto JSON.' });
    }

    const {
        idClase, entrenadorId, fecha, horaInicio, horaFin, capacidadTotal, salon, estatus,
        visibleReservas = true, listaEsperaHabilitada = false,
    } = req.body;

    // Cada campo se valida por separado para poder decir cual esta mal: si un
    // valor invalido llega al modelo, Mongoose lanza una excepcion y el
    // navegador recibe un error 500 de servidor en vez de un 400 util.
    if (!esObjectId(idClase)) {
        return res.status(400).json({ error: 'El identificador de la clase no es valido.' });
    }
    if (entrenadorId !== undefined && entrenadorId !== '' && !esObjectId(entrenadorId)) {
        return res.status(400).json({ error: 'El identificador del entrenador no es valido.' });
    }
    if (!esFechaISO(fecha)) {
        return res.status(400).json({ error: 'La fecha es obligatoria y debe tener formato YYYY-MM-DD.' });
    }
    if (!esEnteroPositivo(capacidadTotal)) {
        return res.status(400).json({ error: 'La capacidad total debe ser un numero entero mayor que 0.' });
    }
    if (!esTextoNoVacio(salon)) {
        return res.status(400).json({ error: 'La sala es obligatoria.' });
    }
    if (estatus !== undefined && estatus !== 'activo' && estatus !== 'inactivo') {
        return res.status(400).json({ error: "El estatus debe ser 'activo' o 'inactivo'." });
    }
    if (typeof visibleReservas !== 'boolean') {
        return res.status(400).json({ error: 'La visibilidad debe ser verdadera o falsa.' });
    }
    if (typeof listaEsperaHabilitada !== 'boolean') {
        return res.status(400).json({ error: 'La lista de espera debe ser verdadera o falsa.' });
    }

    // La sala se guarda sin espacios sobrantes: asi los horarios que se
    // comparan en las validaciones de solapamiento usan el mismo texto.
    const salonFinal = salon.trim();

    // El intervalo debe ser valido y durar al menos 60 minutos.
    const errorHoras = errorIntervaloHorario(horaInicio, horaFin);
    if (errorHoras) {
        return res.status(400).json({ error: errorHoras });
    }

    // Las referencias deben existir de verdad: una clase o un entrenador que no
    // estan en la base no se pueden schedulear.
    // Cast a any: la inferencia de tipos de Mongoose no es fiable en este
    // proyecto (le asigna un tipo de fecha a los campos de texto).
    const claseRef: any = await Clase.findById(idClase);
    if (!claseRef) {
        return res.status(404).json({ error: 'La clase indicada no existe.' });
    }
    let nombreEntrenadorFinal = 'Sin asignar';
    if (entrenadorId) {
        const entrenadorRef: any = await Usuario.findById(entrenadorId);
        if (!entrenadorRef) {
            return res.status(404).json({ error: 'El entrenador indicado no existe.' });
        }
        if (entrenadorRef.rol !== 'entrenador') {
            return res.status(400).json({ error: 'El usuario indicado no es un entrenador.' });
        }
        nombreEntrenadorFinal = nombreCompletoUsuario(entrenadorRef);
        if (!esTextoNoVacio(nombreEntrenadorFinal)) {
            return res.status(400).json({ error: 'El entrenador indicado no tiene nombre registrado.' });
        }
    }
    if (Number(capacidadTotal) > claseRef.capacidad) {
        return res.status(409).json({ error: 'La capacidad total supera la capacidad de la clase' });
    }

    // Validacion: el entrenador no puede tener otro horario en el mismo
    // intervalo de tiempo (clases simultaneas para el mismo entrenador).
    if (entrenadorId) {
        const entrenadorOcupado = await Horario.findOne({
            entrenadorId,
            estatus: 'activo',
            fecha,
            $or: [{ horaInicio: { $lt: horaFin }, horaFin: { $gt: horaInicio } }],
        });
        if (entrenadorOcupado) {
            return res.status(409).json({ error: 'El entrenador ya tiene una clase en este horario. Elige otro.' });
        }
    }

    // Validacion: ya no puede haber un horario en la misma fecha, misma sala y
    // mismo intervalo de tiempo (dos clases en la misma sala a la misma hora).
    const enSala = await Horario.findOne({
        fecha,
        estatus: 'activo',
        salon: salonFinal,
        $or: [
            { horaInicio: { $lt: horaFin }, horaFin: { $gt: horaInicio } },
        ],
    });
    if (enSala) {
        return res.status(409).json({ error: 'Ya hay un horario en esta sala en este intervalo. Elige otro.' });
    }

    const nuevo = await Horario.create({
        idClase,
        // El nombre de la clase y el del entrenador los pone el servidor a
        // partir de las referencias: el navegador no puede inventarlos ni
        // dejarlos vacios.
        nombreClase: claseRef.nombre,
        entrenadorId: entrenadorId ?? '',
        nombreEntrenador: nombreEntrenadorFinal,
        fecha,
        horaInicio,
        horaFin,
        capacidadTotal: Number(capacidadTotal),
        // Al crear, la capacidad disponible arranca igual a la total
        capacidadDisponible: Number(capacidadTotal),
        salon: salonFinal,
        estatus: estatus ?? 'activo',
        visibleReservas,
        listaEsperaHabilitada,
    });

    res.status(201).json(nuevo);
};

export const editarHorario = async (req: Request, res: Response) => {
    // Un id que no es un ObjectId no existe: se responde 400 en vez de dejar
    // que Mongoose lance un CastError (que el navegador veria como un 500).
    if (!esObjectId(req.params.id)) {
        return res.status(400).json({ error: 'El identificador del horario no es valido.' });
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'El cuerpo de la peticion debe ser un objeto JSON.' });
    }

    const existentes = await Horario.findById(req.params.id);
    if (!existentes) return res.status(404).json({ error: 'Horario no encontrado' });

    // Solo se admiten las columnas del horario: asi el navegador no puede
    // pisar campos que son del servidor (por ejemplo _id o capacidadDisponible).
    const camposDesconocidos = Object.keys(req.body).filter(campo => !CAMPOS_PERMITIDOS.includes(campo));
    if (camposDesconocidos.length) {
        return res.status(400).json({ error: `Campos no permitidos: ${camposDesconocidos.join(', ')}` });
    }
    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: 'No se envio ningun cambio para aplicar.' });
    }

    // Cada campo se valida por separado para poder decir cual esta mal.
    if (req.body.idClase !== undefined && !esObjectId(req.body.idClase)) {
        return res.status(400).json({ error: 'El identificador de la clase no es valido.' });
    }
    if (req.body.entrenadorId !== undefined && req.body.entrenadorId !== '' && !esObjectId(req.body.entrenadorId)) {
        return res.status(400).json({ error: 'El identificador del entrenador no es valido.' });
    }
    if (req.body.fecha !== undefined && !esFechaISO(req.body.fecha)) {
        return res.status(400).json({ error: 'La fecha debe tener formato YYYY-MM-DD.' });
    }
    if (req.body.capacidadTotal !== undefined && !esEnteroPositivo(req.body.capacidadTotal)) {
        return res.status(400).json({ error: 'La capacidad total debe ser un numero entero mayor que 0.' });
    }
    if (req.body.salon !== undefined && !esTextoNoVacio(req.body.salon)) {
        return res.status(400).json({ error: 'La sala no puede quedar vacia.' });
    }
    if (req.body.estatus !== undefined && req.body.estatus !== 'activo' && req.body.estatus !== 'inactivo') {
        return res.status(400).json({ error: "El estatus debe ser 'activo' o 'inactivo'." });
    }
    if (req.body.visibleReservas !== undefined && typeof req.body.visibleReservas !== 'boolean') {
        return res.status(400).json({ error: 'La visibilidad debe ser verdadera o falsa.' });
    }
    if (req.body.listaEsperaHabilitada !== undefined && typeof req.body.listaEsperaHabilitada !== 'boolean') {
        return res.status(400).json({ error: 'La lista de espera debe ser verdadera o falsa.' });
    }

    // Valores finales: lo que llega en el parche o, si no llega, lo que ya
    // tiene el horario guardado.
    const inicioFinal = req.body.horaInicio ?? existentes.horaInicio;
    const finFinal = req.body.horaFin ?? existentes.horaFin;
    const errorHoras = errorIntervaloHorario(inicioFinal, finFinal);
    if (errorHoras) {
        return res.status(400).json({ error: errorHoras });
    }

    const idClaseFinal = req.body.idClase ?? existentes.idClase;
    const entrenadorFinal = req.body.entrenadorId ?? existentes.entrenadorId;
    const capacidadFinal = req.body.capacidadTotal !== undefined
        ? Number(req.body.capacidadTotal)
        : existentes.capacidadTotal;

    // Las referencias deben existir de verdad.
    // Cast a any: la inferencia de tipos de Mongoose no es fiable en este
    // proyecto (le asigna un tipo de fecha a los campos de texto).
    const claseRef: any = await Clase.findById(idClaseFinal);
    if (!claseRef) {
        return res.status(404).json({ error: 'La clase indicada no existe.' });
    }
    let nombreEntrenadorFinal = 'Sin asignar';
    if (entrenadorFinal) {
        const entrenadorRef: any = await Usuario.findById(entrenadorFinal);
        if (!entrenadorRef) {
            return res.status(404).json({ error: 'El entrenador indicado no existe.' });
        }
        if (entrenadorRef.rol !== 'entrenador') {
            return res.status(400).json({ error: 'El usuario indicado no es un entrenador.' });
        }
        nombreEntrenadorFinal = nombreCompletoUsuario(entrenadorRef);
        if (!esTextoNoVacio(nombreEntrenadorFinal)) {
            return res.status(400).json({ error: 'El entrenador indicado no tiene nombre registrado.' });
        }
    }
    if (capacidadFinal > claseRef.capacidad) {
        return res.status(409).json({ error: 'La capacidad total supera la capacidad de la clase' });
    }

    // La capacidad no puede bajar de los lugares ya ocupados: si se reduce por
    // debajo, el horario quedaria con mas reservas que plazas.
    const ocupados = Math.max(0, existentes.capacidadTotal - existentes.capacidadDisponible);
    if (capacidadFinal < ocupados) {
        return res.status(409).json({
            error: `La capacidad no puede ser menor que los ${ocupados} lugares ya reservados.`,
        });
    }

    // Validacion: el entrenador no puede tener otro horario en el mismo
    // intervalo (excluyendo el propio horario editado).
    if (entrenadorFinal) {
        const filtroEntrenador: Record<string, unknown> = {
            estatus: 'activo',
            fecha: req.body.fecha ?? existentes.fecha,
            entrenadorId: entrenadorFinal,
            $or: [{ horaInicio: { $lt: finFinal }, horaFin: { $gt: inicioFinal } }],
            _id: { $ne: req.params.id },
        };
        const ocupado = await Horario.findOne(filtroEntrenador).select('_id');
        if (ocupado) {
            return res.status(409).json({ error: 'El entrenador ya tiene una clase en este horario. Elige otro.' });
        }
    }

    // Validacion: no puede haber otro horario en la misma fecha, misma sala y
    // mismo intervalo (excluyendo el propio horario editado).
    if (req.body.fecha !== undefined || req.body.salon !== undefined || req.body.horaInicio !== undefined || req.body.horaFin !== undefined) {
        const filtroSala: Record<string, unknown> = {
            estatus: 'activo',
            fecha: req.body.fecha ?? existentes.fecha,
            salon: req.body.salon ?? existentes.salon,
            $or: [
                { horaInicio: { $lt: finFinal }, horaFin: { $gt: inicioFinal } },
            ],
        };
        filtroSala._id = { $ne: req.params.id };
        const enSala = await Horario.findOne(filtroSala).select('_id');
        if (enSala) {
            return res.status(409).json({ error: 'Ya hay un horario en esta sala en este intervalo. Elige otro.' });
        }
    }

    // Se arma el parche con solo las columnas permitidas y con los nombres
    // resueltos en el servidor.
    const cambios: Record<string, unknown> = {};
    for (const campo of CAMPOS_PERMITIDOS) {
        if (req.body[campo] !== undefined) cambios[campo] = req.body[campo];
    }
    cambios.idClase = idClaseFinal;
    cambios.nombreClase = claseRef.nombre;
    cambios.entrenadorId = entrenadorFinal;
    cambios.nombreEntrenador = nombreEntrenadorFinal;
    if (cambios.salon !== undefined) cambios.salon = String(cambios.salon).trim();
    if (req.body.capacidadTotal !== undefined) {
        cambios.capacidadTotal = capacidadFinal;
        // La capacidad disponible se recalcula sobre los lugares ya ocupados:
        // si no, al subir el total se perderian las reservas ya hechas.
        cambios.capacidadDisponible = Math.max(0, capacidadFinal - ocupados);
    }

    const horario = await Horario.findByIdAndUpdate(req.params.id, cambios, { new: true });
    if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });
    res.json(horario);
};

export const editarExcepcionHorario = async (req: Request, res: Response) => {
    if (!esObjectId(req.params.id)) {
        return res.status(400).json({ error: 'El identificador del horario no es valido.' });
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Envia los cambios de la sesion.' });
    }
    const camposDesconocidos = Object.keys(req.body).filter(campo => !CAMPOS_EXCEPCION.includes(campo));
    if (camposDesconocidos.length) {
        return res.status(400).json({ error: `Campo no permitido: ${camposDesconocidos[0]}.` });
    }
    if (!Object.keys(req.body).length) {
        return res.status(400).json({ error: 'Envia al menos un cambio para la sesion.' });
    }

    const existente: any = await Horario.findById(req.params.id);
    if (!existente) return res.status(404).json({ error: 'Horario no encontrado.' });
    if (existente.origen !== 'plantilla' || !existente.idPlantilla) {
        return res.status(409).json({ error: 'Solo las sesiones generadas por una programacion semanal pueden marcarse como excepcion.' });
    }

    const entrenadorId = String(req.body.entrenadorId ?? existente.entrenadorId ?? '');
    const salon = String(req.body.salon ?? existente.salon).trim();
    const horaInicio = String(req.body.horaInicio ?? existente.horaInicio);
    const horaFin = String(req.body.horaFin ?? existente.horaFin);
    const estatus = String(req.body.estatus ?? existente.estatus);
    const visibleReservas = req.body.visibleReservas ?? existente.visibleReservas ?? true;
    const listaEsperaHabilitada = req.body.listaEsperaHabilitada ?? existente.listaEsperaHabilitada ?? false;

    if (!esObjectId(entrenadorId)) return res.status(400).json({ error: 'Selecciona un instructor valido.' });
    if (!esTextoNoVacio(salon)) return res.status(400).json({ error: 'La sala es obligatoria.' });
    const errorHoras = errorIntervaloHorario(horaInicio, horaFin);
    if (errorHoras) return res.status(400).json({ error: errorHoras });
    if (estatus !== 'activo' && estatus !== 'inactivo') {
        return res.status(400).json({ error: "El estatus debe ser 'activo' o 'inactivo'." });
    }
    if (typeof visibleReservas !== 'boolean') {
        return res.status(400).json({ error: 'La visibilidad debe ser verdadera o falsa.' });
    }
    if (typeof listaEsperaHabilitada !== 'boolean') {
        return res.status(400).json({ error: 'La lista de espera debe ser verdadera o falsa.' });
    }

    const entrenador: any = await Usuario.findById(entrenadorId);
    if (!entrenador || entrenador.rol !== 'entrenador' || entrenador.estatus !== 'activo') {
        return res.status(400).json({ error: 'El usuario seleccionado no es un instructor activo.' });
    }
    const nombreEntrenador = nombreCompletoUsuario(entrenador);
    if (!esTextoNoVacio(nombreEntrenador)) {
        return res.status(400).json({ error: 'El instructor seleccionado no tiene nombre registrado.' });
    }

    if (estatus === 'activo') {
        const cruceEntrenador = await Horario.findOne({
            _id: { $ne: existente._id },
            estatus: 'activo',
            fecha: existente.fecha,
            entrenadorId,
            horaInicio: { $lt: horaFin },
            horaFin: { $gt: horaInicio },
        }).select('_id');
        if (cruceEntrenador) {
            return res.status(409).json({ error: 'El instructor ya tiene una clase en este horario. Elige otro.' });
        }
        const cruceSala = await Horario.findOne({
            _id: { $ne: existente._id },
            estatus: 'activo',
            fecha: existente.fecha,
            salon,
            horaInicio: { $lt: horaFin },
            horaFin: { $gt: horaInicio },
        }).select('_id');
        if (cruceSala) {
            return res.status(409).json({ error: 'Ya hay un horario en esta sala en este intervalo. Elige otro.' });
        }
    }

    existente.entrenadorId = entrenador._id.toString();
    existente.nombreEntrenador = nombreEntrenador;
    existente.salon = salon;
    existente.horaInicio = horaInicio;
    existente.horaFin = horaFin;
    existente.estatus = estatus;
    existente.visibleReservas = visibleReservas;
    existente.listaEsperaHabilitada = listaEsperaHabilitada;
    existente.esExcepcionPlantilla = true;
    await existente.save();

    res.json({
        mensaje: 'La sesion fue actualizada como excepcion de la programacion semanal.',
        horario: existente,
    });
};

export const eliminarHorario = async (req: Request, res: Response) => {
    // Un id que no es un ObjectId no existe: se responde 400 en vez de dejar
    // que Mongoose lance un CastError (que el navegador veria como un 500).
    if (!esObjectId(req.params.id)) {
        return res.status(400).json({ error: 'El identificador del horario no es valido.' });
    }

    const eliminado = await Horario.findByIdAndDelete(req.params.id);
    if (!eliminado) return res.status(404).json({ error: 'Horario no encontrado' });
    res.json({ mensaje: 'Horario eliminado' });
};
