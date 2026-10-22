export const ROLES = ['administrador', 'entrenador', 'recepcion', 'cliente'] as const;
export type UserRole = (typeof ROLES)[number];