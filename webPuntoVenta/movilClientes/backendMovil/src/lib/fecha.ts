// Fechas y horas en la zona horaria del negocio (no en UTC).
// Cambia la zona con APP_TZ en el .env si hace falta.
const TZ = process.env.APP_TZ ?? 'America/Mazatlan';

const formateador = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
});

function partes(d: Date): Record<string, string> {
    return Object.fromEntries(formateador.formatToParts(d).map((p) => [p.type, p.value]));
}

/** YYYY-MM-DD en la zona del negocio */
export function fechaLocal(d: Date = new Date()): string {
    const p = partes(d);
    return `${p.year}-${p.month}-${p.day}`;
}

/** HH:MM (24 h) en la zona del negocio */
export function horaLocal(d: Date = new Date()): string {
    const p = partes(d);
    return `${p.hour}:${p.minute}`;
}

/** Suma (o resta) días a una fecha YYYY-MM-DD */
export function sumarDias(fecha: string, dias: number): string {
    const [a, m, d] = fecha.split('-').map(Number);
    const f = new Date(Date.UTC(a, m - 1, d + dias));
    return f.toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo) de una fecha YYYY-MM-DD */
export function diaSemana(fecha: string): number {
    const [a, m, d] = fecha.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

// Diferencia (minutos) entre la hora local de la zona del negocio y UTC en un instante dado
function desfaseMinutos(instante: Date): number {
    const p = partes(instante);
    const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    return Math.round((comoUtc - Math.floor(instante.getTime() / 60000) * 60000) / 60000);
}

/** Instante real (Date) en que ocurre "fecha hora" en la zona del negocio */
export function instante(fecha: string, hora: string): Date {
    const [a, m, d] = fecha.split('-').map(Number);
    const [h, min] = hora.split(':').map(Number);
    const ingenuo = Date.UTC(a, m - 1, d, h, min);
    let real = ingenuo - desfaseMinutos(new Date(ingenuo)) * 60000;
    // segunda pasada por si el desfase cambia entre el cálculo inicial y el real (horario de verano)
    real = ingenuo - desfaseMinutos(new Date(real)) * 60000;
    return new Date(real);
}

/** Minutos entre dos horas HH:MM (b - a) */
export function minutosEntre(a: string, b: string): number {
    const [ha, ma] = a.split(':').map(Number);
    const [hb, mb] = b.split(':').map(Number);
    return hb * 60 + mb - (ha * 60 + ma);
}
