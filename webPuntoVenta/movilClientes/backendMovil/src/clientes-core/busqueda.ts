// ============================================================================
// NÚCLEO COMPARTIDO DE CLIENTES  ·  busqueda.ts
// Carpeta idéntica en backend-administrativa y movilClientes/backendMovil (ver cliente.model.ts).
//
// Buscador de clientes: solo por nombre y/o apellidos, sin importar acentos ni mayúsculas.
// "Pedro Páramo" se encuentra con: pedro · PEDRO · Pédro · pedro paramo · PÉDRÓ PÁRÁMÓ · PEDRO páramo ...
// No hace falta guardar ningún campo extra: el filtro arma una expresión regular tolerante a acentos.
// ============================================================================

// Cada letra base → todas las formas con que puede aparecer (minúscula y mayúscula, con y sin acento).
const VARIANTES: Record<string, string> = {
    a: 'aAáÁàÀäÄâÂãÃ',
    e: 'eEéÉèÈëËêÊ',
    i: 'iIíÍìÌïÏîÎ',
    o: 'oOóÓòÒöÖôÔõÕ',
    u: 'uUúÚùÙüÜûÛ',
    n: 'nNñÑ',
    c: 'cCçÇ',
};

/** Quita acentos y pasa a minúsculas: "PÉDRÓ" → "pedro". */
export function sinAcentos(texto: string): string {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const escapar = (c: string) => c.replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&');

/** Expresión regular (texto) que reconoce `consulta` con o sin acentos y en cualquier combinación de mayúsculas. */
export function patronBusqueda(consulta: string): string {
    const palabras = sinAcentos(consulta).split(/\s+/).filter(Boolean);
    return palabras
        .map(p => [...p].map(c => (VARIANTES[c] ? `[${VARIANTES[c]}]` : escapar(c))).join(''))
        .join('\\s+');
}

/**
 * Filtro de Mongo para el buscador de clientes (nombre y/o apellidos, juntos o por separado).
 * Devuelve null si la consulta está vacía.
 */
export function filtroBusquedaClientes(consulta: unknown): Record<string, any> | null {
    if (typeof consulta !== 'string' || !consulta.trim()) return null;
    const patron = patronBusqueda(consulta);
    return {
        $expr: {
            $regexMatch: {
                input: { $concat: [{ $ifNull: ['$nombre', ''] }, ' ', { $ifNull: ['$apellidos', ''] }] },
                regex: patron,
                options: 'i',
            },
        },
    };
}
