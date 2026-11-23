export const VIGENTE_DESDE = '2026-10-27';
export const DIAS_GENERADOS = 90;
export const CLASES_RETIRADAS = ['Force Room', 'Reset Room', 'Open Gym'];

export const entrenadores = [
    { nombre: 'Andrea', apellidos: 'Solís', correo: 'andrea.solis@gymfit.mx', codigoAcceso: 'ENT002' },
    { nombre: 'Luis', apellidos: 'Herrera', correo: 'luis.herrera@gymfit.mx', codigoAcceso: 'ENT003' },
    { nombre: 'Paola', apellidos: 'Ibarra', correo: 'paola.ibarra@gymfit.mx', codigoAcceso: 'ENT004' },
    { nombre: 'Diego', apellidos: 'Mora', correo: 'diego.mora@gymfit.mx', codigoAcceso: 'ENT005' },
] as const;

export const catalogo = [
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

export type NombreClase = typeof catalogo[number]['nombre'];
export type NombreEntrenador = `${typeof entrenadores[number]['nombre']} ${typeof entrenadores[number]['apellidos']}`;

export interface Regla {
    clase: NombreClase;
    salon: 'Force Room' | 'Reset Room';
    entrenador?: NombreEntrenador;
    diaSemana: number;
    horaInicio: string;
    horaFin: string;
    capacidadTotal: number;
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

export function construirReglas(): Regla[] {
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
