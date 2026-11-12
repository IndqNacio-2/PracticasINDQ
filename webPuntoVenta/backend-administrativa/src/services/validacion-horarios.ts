import { esHoraHHMM } from '../lib/validacion';

export const DURACION_MINIMA_MINUTOS = 30;

export function minutosDeHora(hora: string): number | null {
    if (!esHoraHHMM(hora)) return null;
    const [horas, minutos] = hora.split(':').map(Number);
    return horas * 60 + minutos;
}

export function errorIntervaloHorario(horaInicio: string, horaFin: string): string | null {
    const inicio = minutosDeHora(horaInicio);
    const fin = minutosDeHora(horaFin);
    if (inicio === null || fin === null) {
        return 'Las horas de inicio y fin deben tener formato HH:MM.';
    }
    if (fin <= inicio) {
        return 'La hora de fin debe ser posterior a la hora de inicio.';
    }
    if (fin - inicio < DURACION_MINIMA_MINUTOS) {
        return `La duracion del horario debe ser de al menos ${DURACION_MINIMA_MINUTOS} minutos.`;
    }
    return null;
}

export function nombreCompletoUsuario(usuario: any): string {
    return [usuario?.nombre, usuario?.apellidos]
        .filter(parte => typeof parte === 'string' && parte.trim().length > 0)
        .map(parte => parte.trim())
        .join(' ');
}