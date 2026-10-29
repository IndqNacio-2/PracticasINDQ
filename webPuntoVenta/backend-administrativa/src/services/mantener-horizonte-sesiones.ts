import { generarSesionesDesdePlantillas, type ResultadoGeneracion } from './generar-sesiones';

export const DIAS_HORIZONTE_MOVIL = 56;
const INTERVALO_MINIMO_AUTOMATICO_MS = 5 * 60 * 1000;
const INTERVALO_PROGRAMADO_MS = 6 * 60 * 60 * 1000;

let ejecucionActual: Promise<ResultadoGeneracion> | null = null;
let ultimaEjecucion = 0;
let ultimoDesde = '';
let ultimoResultado: ResultadoGeneracion | null = null;
let programadorIniciado = false;

function fechaISO(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
}

/**
 * Completa la ventana [hoy, hoy + 55]. El generador usa claveGeneracion y
 * $setOnInsert, por lo que esta operacion es idempotente y no sobrescribe
 * excepciones ni sesiones que fueron desactivadas individualmente.
 */
export async function mantenerHorizonteSesiones(
    opciones: { ahora?: Date; forzar?: boolean } = {}
): Promise<ResultadoGeneracion> {
    const ahora = opciones.ahora ?? new Date();
    const desde = fechaISO(ahora);
    if (
        !opciones.forzar &&
        ultimoResultado &&
        ultimoDesde === desde &&
        ahora.getTime() - ultimaEjecucion < INTERVALO_MINIMO_AUTOMATICO_MS
    ) {
        return ultimoResultado;
    }
    if (ejecucionActual) return ejecucionActual;

    ejecucionActual = generarSesionesDesdePlantillas(desde, DIAS_HORIZONTE_MOVIL)
        .then(resultado => {
            ultimaEjecucion = ahora.getTime();
            ultimoDesde = desde;
            ultimoResultado = resultado;
            return resultado;
        })
        .finally(() => {
            ejecucionActual = null;
        });
    return ejecucionActual;
}

function ejecutarAutomaticamente(origen: string): void {
    mantenerHorizonteSesiones()
        .then(resultado => {
            if (resultado.sesionesCreadas > 0) {
                console.log(
                    `[Horizonte movil:${origen}] ${resultado.sesionesCreadas} sesiones creadas; ` +
                    `ventana ${resultado.desde} a ${resultado.hasta}.`
                );
            }
        })
        .catch(error => {
            console.error(`[Horizonte movil:${origen}] No se pudieron extender las sesiones:`, error);
        });
}

/** Inicia una sola tarea periodica por proceso y realiza la primera extension. */
export function iniciarMantenimientoHorizonte(): void {
    if (programadorIniciado) return;
    programadorIniciado = true;
    ejecutarAutomaticamente('inicio');
    const temporizador = setInterval(
        () => ejecutarAutomaticamente('programado'),
        INTERVALO_PROGRAMADO_MS
    );
    temporizador.unref();
}