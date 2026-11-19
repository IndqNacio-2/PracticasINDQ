export const PREFIJOS_USUARIO = {
  administrador: 'ADM', entrenador: 'ENT', recepcion: 'REC', vendedor: 'VEN',
} as const;

export type RolCodigo = keyof typeof PREFIJOS_USUARIO;
export const numeroDeCodigo = (codigo: unknown): string | null => {
  if (typeof codigo !== 'string') return null;
  const numero = /^(?:[A-Z]+-?)?(\d+)$/i.exec(codigo.trim())?.[1];
  return numero ? numero.replace(/^0+(?=\d)/, '') : null;
};

export function validarCodigoUsuario(codigo: unknown, rol: string): string | null {
  const prefijo = PREFIJOS_USUARIO[rol as RolCodigo];
  if (!prefijo) return 'Selecciona un rol válido.';
  if (typeof codigo !== 'string' || !new RegExp(`^${prefijo}\\d{1,27}$`).test(codigo)) {
    return `El código debe comenzar con ${prefijo} y contener de 1 a 27 dígitos después del prefijo.`;
  }
  return null;
}