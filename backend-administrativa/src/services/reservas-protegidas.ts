import { pool } from '../lib/post';

interface ReservaCobro {
    horarioId?: string;
    capacityStatus?: string;
    class?: string;
    time?: string;
    fecha?: string;
    status?: string;
}

export async function obtenerDetalleReservas(): Promise<ReservaCobro[]> {
    // Lectura interna de la misma fuente que usa Cobro. No llamar por HTTP a
    // una ruta de personal: las tareas automáticas no tienen token de usuario.
    const resultado = await pool.query<ReservaCobro>(`SELECT horario_id AS "horarioId",
        estado_cupo AS "capacityStatus", clase AS class, hora AS time, fecha, estado AS status
        FROM webcobro.reservas`);
    return resultado.rows;
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
    try {
        const reservas = await obtenerDetalleReservas();
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
    }
}