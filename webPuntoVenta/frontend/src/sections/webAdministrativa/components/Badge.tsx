interface BadgeProps {
  variant: 'activo' | 'inactivo' | 'confirmada' | 'pendiente' | 'cancelada' | 'asistencia' | 'retardo' | 'falta' | 'administrador' | 'entrenador' | 'recepcion' | 'cliente';
  label?: string;
}

const configs: Record<string, string> = {
  activo: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  inactivo: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
  confirmada: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  pendiente: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  cancelada: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  asistencia: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  retardo: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  falta: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  administrador: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  entrenador: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  recepcion: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  cliente: 'bg-slate-50 text-slate-600 ring-1 ring-slate-200',
};

const defaultLabels: Record<string, string> = {
  activo: 'Activo', inactivo: 'Inactivo', confirmada: 'Confirmada',
  pendiente: 'Pendiente', cancelada: 'Cancelada', asistencia: 'Asistencia',
  retardo: 'Retardo', falta: 'Falta', administrador: 'Administrador',
  entrenador: 'Entrenador', recepcion: 'Recepción', cliente: 'Cliente',
};

export function Badge({ variant, label }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${configs[variant]}`}>
      {label ?? defaultLabels[variant]}
    </span>
  );
}
