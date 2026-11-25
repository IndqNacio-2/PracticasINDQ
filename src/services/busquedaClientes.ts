// Solo recibe nombres: los códigos del checador se resuelven por separado.
export const normalizarNombre = (valor: unknown): string =>
  String(valor ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');

export const coincideNombre = (nombre: unknown, consulta: string): boolean =>
  normalizarNombre(nombre).includes(normalizarNombre(consulta));