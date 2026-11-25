interface BadgeProps {
  variant: 'activo' | 'inactivo' | 'confirmada' | 'pendiente' | 'cancelada' | 'asistencia' | 'retardo' | 'falta' | 'administrador' | 'entrenador' | 'recepcion' | 'vendedor' | 'cliente';
  label?: string;
}

const configs: Record<string, string> = {
  activo: 'rx-badge--success',
  inactivo: 'rx-badge--neutral',
  confirmada: 'rx-badge--success',
  pendiente: 'rx-badge--warning',
  cancelada: 'rx-badge--danger',
  asistencia: 'rx-badge--success',
  retardo: 'rx-badge--warning',
  falta: 'rx-badge--danger',
  administrador: 'rx-badge--neutral',
  entrenador: 'rx-badge--neutral',
  recepcion: 'rx-badge--neutral',
  vendedor: 'rx-badge--neutral',
  cliente: 'rx-badge--neutral',
};

const defaultLabels: Record<string, string> = {
  activo: 'Activo', inactivo: 'Inactivo', confirmada: 'Confirmada',
  pendiente: 'Pendiente', cancelada: 'Cancelada', asistencia: 'Asistencia',
  retardo: 'Retardo', falta: 'Falta', administrador: 'Administrador',
  entrenador: 'Entrenador', recepcion: 'Recepción', vendedor: 'Vendedor', cliente: 'Cliente',
};

export function Badge({ variant, label }: BadgeProps) {
  return (
    <span className={`rx-badge ${configs[variant]}`}>
      {label ?? defaultLabels[variant]}
    </span>
  );
}
