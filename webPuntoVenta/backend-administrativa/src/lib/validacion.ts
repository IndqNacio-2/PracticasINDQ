/*
 * Utilidades de validacion compartidas por las rutas de la administrativa.
 * Sirven para rechazar datos mal formados con un 400 claro ANTES de que
 * lleguen a Mongoose: si un valor no cumple el esquema, el driver lanza una
 * excepcion que el navegador recibe como un error 500 de servidor.
 */

/* Texto informado y no vacio (los espacios no cuentan como contenido). */
export function esTextoNoVacio(valor: unknown): valor is string {
    return typeof valor === 'string' && valor.trim().length > 0;
}

/* Identificador de MongoDB (ObjectId de 24 hexadecimales). */
export function esObjectId(valor: unknown): boolean {
    return typeof valor === 'string' && /^[0-9a-fA-F]{24}$/.test(valor);
}

/*
 * Fecha en formato YYYY-MM-DD. Ademas del formato se comprueba que la fecha
 * exista de verdad (por ejemplo "2026-02-30" se rechaza).
 */
export function esFechaISO(valor: unknown): boolean {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const [anio, mes, dia] = valor.split('-').map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    return (
        fecha.getUTCFullYear() === anio &&
        fecha.getUTCMonth() === mes - 1 &&
        fecha.getUTCDate() === dia
    );
}

/* Hora en formato HH:MM (00:00 a 23:59). */
export function esHoraHHMM(valor: unknown): boolean {
    if (typeof valor !== 'string' || !/^\d{2}:\d{2}$/.test(valor)) return false;
    const [horas, minutos] = valor.split(':').map(Number);
    return horas <= 23 && minutos <= 59;
}

/*
 * Numero entero positivo (1, 2, 3...). Se rechazan los decimales, los
 * negativos, el cero y los valores no numericos como "muchos" o "10abc".
 */
export function esEnteroPositivo(valor: unknown): boolean {
    if (typeof valor === 'number') return Number.isInteger(valor) && valor >= 1;
    if (typeof valor === 'string' && /^\d+$/.test(valor.trim())) {
        return Number(valor.trim()) >= 1;
    }
    return false;
}
