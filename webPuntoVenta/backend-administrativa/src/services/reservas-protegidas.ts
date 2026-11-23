import type { Model } from 'mongoose';
import { Reservacion } from '../models/Reservaciones/reservacion';

interface ReservaCobro {
    horarioId?: string;
    capacityStatus?: string;
    class?: string;
    time?: string;
    fecha?: string;
    status?: string;
}

// Las reservaciones viven en MongoDB (fuente única para cobro, administrativa y app móvil):
// aquí se leen directo de la colección, ya no por HTTP desde cobro.
const Reservaciones = Reservacion as unknown as Model<any>;

// Misma forma que usaban estas funciones (class/time/fecha/status/capacityStatus).
function aReserva(r: any): ReservaCobro {
    return {
        horarioId: r.idHorario,
        capacityStatus: r.estadoCupo ?? 'confirmada',
        class: r.clase,
        time: String(r.horaClase ?? '').match(/\d{1,2}:\d{2}/)?.[0] ?? '',
        fecha: r.fechaClase ?? r.fechaReservacion,
        status: r.estatus,
    };
}

export async function obtenerDetalleReservas(): Promise<ReservaCobro[]> {
    try {
        const filas = await Reservaciones.find({}).select('idHorario estadoCupo clase horaClase fechaClase fechaReservacion estatus').lean();
        return filas.map(aReserva);
    } catch {
        throw new Error('No se pudo comprobar el historial de reservas; no se hizo ningun cambio.');
    }
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
