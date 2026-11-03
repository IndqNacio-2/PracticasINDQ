interface ReservaCobro {
    class?: string;
    time?: string;
    fecha?: string;
    status?: string;
}

const API_RESERVAS = process.env.COBRO_RESERVAS_URL ?? 'http://localhost:3000/cobro/api/reservas';

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
                    (opciones.incluirCanceladas || (
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