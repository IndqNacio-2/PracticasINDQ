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
import {
    VIGENTE_DESDE,
    DIAS_GENERADOS,
    CLASES_RETIRADAS,
    entrenadores,
    catalogo,
    construirReglas,
} from '../data/programacion-semanal.seed';
import { obtenerReservasProtegidas } from '../services/reservas-protegidas';

const PERMITIR_LIMPIEZA = process.env.PROGRAMACION_SEED_PERMITIR_LIMPIEZA === 'true';

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

    let sesionesEliminadas = 0;
    let sesionesProtegidas = 0;
    if (PERMITIR_LIMPIEZA) {
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
        
            sesionesEliminadas = sesionesEliminables.length;
        sesionesProtegidas = sesionesProvisionales.length - sesionesEliminables.length;
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
    console.log(`Modo de limpieza destructiva: ${PERMITIR_LIMPIEZA ? 'habilitado' : 'deshabilitado'} (por defecto conserva todos los datos existentes)`);
    console.log(`Entrenadores activos de la app móvil: ${entrenadores.length}`);
    console.log(`Clases operativas activas: ${catalogo.length}`);
    console.log(`Plantillas semanales activas: ${reglas.length}`);
    console.log(`Sesiones provisionales eliminadas: ${sesionesEliminadas}`);
    console.log(`Sesiones provisionales protegidas por reservación: ${sesionesProtegidas}`);
    console.log(`Sesiones creadas: ${generacion.sesionesCreadas}; ya existentes: ${generacion.sesionesExistentes}`);
    console.log(`Ventana generada: ${generacion.desde} a ${generacion.hasta}`);
    await mongoose.disconnect();
}

main().catch(async error => {
    console.error('No se pudo cargar la programación semanal:', error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
});