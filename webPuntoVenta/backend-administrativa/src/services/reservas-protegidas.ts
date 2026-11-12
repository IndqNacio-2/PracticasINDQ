interface ReservaCobro {
    horarioId?: string;
    capacityStatus?: string;
    class?: string;
    time?: string;
    fecha?: string;
    status?: string;
}

const API_RESERVAS = process.env.COBRO_RESERVAS_URL ?? 'http://localhost:3000/cobro/api/reservas';

export async function obtenerDetalleReservas(): Promise<ReservaCobro[]> {
    const respuesta = await fetch(API_RESERVAS, { signal: AbortSignal.timeout(10_000) });
    if (!respuesta.ok) throw new Error('No se pudo comprobar el historial de reservas; no se hizo ningun cambio.');
    const reservas = await respuesta.json();
    if (!Array.isArray(reservas)) throw new Error('Respuesta de reservas no valida.');
    return reservas;
}

export function reservasDeHorario(reservas: ReservaCobro[], horario: {
    id?: string; idHorario?: string; nombreClase: string; fecha: string; horaInicio: string;
}) {
    return reservas.filter(r => r.horarioId
        ? r.horarioId === String(horario.idHorario ?? horario.id)
        : r.class === horario.nombreClase && r.fecha === horario.fecha && r.time === horario.horaInicio);
}

export function ocupacionReal(reservas: ReservaCobro[]) {
    return reservas.filter(r => r.capacityStatus !== 'espera'
        && !['cancelado', 'cancelada', 'no_asistio'].includes(r.status ?? '')).length;
}

export async function obtenerReservasProtegidas(
    opciones: { incluirCanceladas?: boolean; mensajeError?: string } = {}
): Promise<Set<string>> {
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
                    (opciones.incluirCanceladas !== false || (
                        reserva.status !== 'cancelado' && reserva.status !== 'cancelada'
                    ))
                ))
                .map(reserva => `${reserva.class}|${reserva.fecha}|${reserva.time}`)
        );
    } catch (error) {
        const mensaje = opciones.mensajeError ?? 'No se pudieron comprobar las reservaciones; no se hizo ningun cambio.';
        throw new Error(`${mensaje} ${error}`);
    } finally {
        clearTimeout(timeout);
    }
}