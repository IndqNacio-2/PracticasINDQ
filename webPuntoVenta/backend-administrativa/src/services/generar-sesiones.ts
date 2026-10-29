import { Horario } from '../models/Horarios/horarios';
import { PlantillaHorario } from '../models/PlantillasHorarios/plantillasHorarios';

const MS_DIA = 24 * 60 * 60 * 1000;

function fechaISO(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
}

function fechaUTC(valor: string): Date {
    return new Date(`${valor}T00:00:00.000Z`);
}

export interface ResultadoGeneracion {
    desde: string;
    hasta: string;
    plantillasActivas: number;
    sesionesCreadas: number;
    sesionesExistentes: number;
}

interface PlantillaPlana {
    _id: { toString(): string };
    idClase: string;
    nombreClase: string;
    entrenadorId: string;
    nombreEntrenador: string;
    diaSemana: number;
    horaInicio: string;
    horaFin: string;
    capacidadTotal: number;
    salon: string;
    vigenteDesde: string;
    vigenteHasta: string;
    visibleReservas: boolean;
    listaEsperaHabilitada: boolean;
}

/**
 * Materializa las reglas semanales como sesiones fechadas. La clave de
 * generación es única, por lo que ejecutar este proceso varias veces no crea
 * duplicados.
 */
export async function generarSesionesDesdePlantillas(
    desde: string,
    dias: number,
    idsPlantillas?: string[]
): Promise<ResultadoGeneracion> {
    const inicio = fechaUTC(desde);
    const fin = new Date(inicio.getTime() + (dias - 1) * MS_DIA);
    const hasta = fechaISO(fin);
    const filtroPlantillas: Record<string, unknown> = {
        estatus: 'activo',
        vigenteDesde: { $lte: hasta },
        $or: [{ vigenteHasta: '' }, { vigenteHasta: { $gte: desde } }],
    };
    if (idsPlantillas) filtroPlantillas._id = { $in: idsPlantillas };
    const plantillas = await (PlantillaHorario as any).find(filtroPlantillas).lean() as PlantillaPlana[];

    const operaciones: Parameters<typeof Horario.bulkWrite>[0] = [];
    for (let cursor = new Date(inicio); cursor <= fin; cursor = new Date(cursor.getTime() + MS_DIA)) {
        const fecha = fechaISO(cursor);
        for (const plantilla of plantillas) {
            if (cursor.getUTCDay() !== plantilla.diaSemana) continue;
            if (fecha < plantilla.vigenteDesde) continue;
            if (plantilla.vigenteHasta && fecha > plantilla.vigenteHasta) continue;

            const idPlantilla = plantilla._id.toString();
            const claveGeneracion = `${idPlantilla}:${fecha}`;
            operaciones.push({
                updateOne: {
                    filter: { claveGeneracion },
                    update: {
                        $setOnInsert: {
                            idClase: plantilla.idClase,
                            nombreClase: plantilla.nombreClase,
                            entrenadorId: plantilla.entrenadorId,
                            nombreEntrenador: plantilla.nombreEntrenador || 'Sin asignar',
                            fecha,
                            horaInicio: plantilla.horaInicio,
                            horaFin: plantilla.horaFin,
                            capacidadTotal: plantilla.capacidadTotal,
                            capacidadDisponible: plantilla.capacidadTotal,
                            estatus: 'activo',
                            salon: plantilla.salon,
                            idPlantilla,
                            claveGeneracion,
                            origen: 'plantilla',
                            esExcepcionPlantilla: false,
                            visibleReservas: plantilla.visibleReservas ?? true,
                            listaEsperaHabilitada: plantilla.listaEsperaHabilitada ?? false,
                        },
                    },
                    upsert: true,
                },
            });
        }
    }

    if (!operaciones.length) {
        return { desde, hasta, plantillasActivas: plantillas.length, sesionesCreadas: 0, sesionesExistentes: 0 };
    }

    const resultado = await Horario.bulkWrite(operaciones, { ordered: false });
    const creadas = resultado.upsertedCount;
    return {
        desde,
        hasta,
        plantillasActivas: plantillas.length,
        sesionesCreadas: creadas,
        sesionesExistentes: operaciones.length - creadas,
    };
}