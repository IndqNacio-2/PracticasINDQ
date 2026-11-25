interface BadgeProps {
  variant: 'activo' | 'inactivo' | 'confirmada' | 'pendiente' | 'cancelada' | 'asistencia' | 'retardo' | 'falta' | 'administrador' | 'entrenador' | 'recepcion' | 'vendedor' | 'cliente';
  label?: string;
}

const configs: Record<string, string> = {
  activo: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  inactivo: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
  confirmada: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  pendiente: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  cancelada: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  asistencia: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  retardo: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  falta: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  administrador: 'bg-[#F3F4F6] text-[#6B7280] ring-1 ring-[#6B7280]',
  entrenador: 'bg-[#F3F4F6] text-[#6B7280] ring-1 ring-[#6B7280]',
  recepcion: 'bg-[#F3F4F6] text-[#6B7280] ring-1 ring-[#6B7280]',
  vendedor: 'bg-[#F3F4F6] text-[#6B7280] ring-1 ring-[#6B7280]',
  cliente: 'bg-gray-50 text-gray-600 ring-1 ring-gray-200',
};

const defaultLabels: Record<string, string> = {
  activo: 'Activo', inactivo: 'Inactivo', confirmada: 'Confirmada',
  pendiente: 'Pendiente', cancelada: 'Cancelada', asistencia: 'Asistencia',
  retardo: 'Retardo', falta: 'Falta', administrador: 'Administrador',
  entrenador: 'Entrenador', recepcion: 'Recepción', vendedor: 'Vendedor', cliente: 'Cliente',
};

export function Badge({ variant, label }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${configs[variant]}`}>
      {label ?? defaultLabels[variant]}
    </span>
  );
}
