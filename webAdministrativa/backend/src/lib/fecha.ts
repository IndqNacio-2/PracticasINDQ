// Fechas y horas en la zona horaria del negocio (no en UTC).
// toISOString() devuelve UTC: una venta hecha a las 6 pm en Culiacán (UTC-7)
// quedaría registrada al día siguiente. Estas funciones evitan ese problema.
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

/** Diferencia en minutos entre dos horas HH:MM (b - a) */
export function minutosEntre(a: string, b: string): number {
    const [ha, ma] = a.split(':').map(Number);
    const [hb, mb] = b.split(':').map(Number);
    return hb * 60 + mb - (ha * 60 + ma);
}
