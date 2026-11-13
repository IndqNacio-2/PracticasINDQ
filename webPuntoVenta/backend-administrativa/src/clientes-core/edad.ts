// clientes-core/edad.ts
// Reglas de edad compartidas por la web administrativa y la app móvil.
export const EDAD_MIN = 12;
export const EDAD_MAX = 99;

// fechaISO y hoyISO: "AAAA-MM-DD". Compara mes y día para que el cumpleaños cuente exacto.
export function calcularEdad(fechaISO: string, hoyISO: string): number {
    const [y, m, d] = fechaISO.slice(0, 10).split('-').map(Number);
    const [hy, hm, hd] = hoyISO.split('-').map(Number);
    let edad = hy - y;
    if (hm < m || (hm === m && hd < d)) edad--;
    return edad;
}

// Devuelve el mensaje de error o null si la edad está entre 12 y 99 (ambos incluidos).
export function errorEdad(fechaISO: string, hoyISO: string): string | null {
    const edad = calcularEdad(fechaISO, hoyISO);
    if (edad < EDAD_MIN) return `El cliente debe tener al menos ${EDAD_MIN} años.`;
    if (edad > EDAD_MAX) return `El cliente no puede tener más de ${EDAD_MAX} años.`;
    return null;
}