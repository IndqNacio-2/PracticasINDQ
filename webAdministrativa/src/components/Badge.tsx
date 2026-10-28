interface BadgeProps {
  variant: 'activo' | 'inactivo' | 'confirmada' | 'pendiente' | 'cancelada' | 'asistencia' | 'retardo' | 'falta' | 'administrador' | 'entrenador' | 'recepcion' | 'cliente';
  label?: string;
}

const OK = 'bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]';
const WARN = 'bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]';
const BAD = 'bg-[color:var(--bad-bg)] text-[color:var(--bad-ink)]';
const MUTED = 'bg-[#ECEDF0] text-[color:var(--ink2)]';

const configs: Record<string, string> = {
  activo: OK,
  inactivo: MUTED,
  confirmada: OK,
  pendiente: 'bg-[#FCEFB4] text-[#7A5B00]',
  cancelada: BAD,
  asistencia: OK,
  retardo: WARN,
  falta: BAD,
  administrador: 'bg-[color:var(--violet-bg)] text-[color:var(--violet)]',
  entrenador: 'bg-[color:var(--info-bg)] text-[color:var(--info)]',
  recepcion: 'bg-[#EEF0F3] text-[color:var(--ink2)]',
  cliente: 'bg-[color:var(--soft)] text-[color:var(--ink2)]',
};

const defaultLabels: Record<string, string> = {
  activo: 'Activo', inactivo: 'Inactivo', confirmada: 'Confirmada',
  pendiente: 'Pendiente', cancelada: 'Cancelada', asistencia: 'Asistencia',
  retardo: 'Retardo', falta: 'Falta', administrador: 'Administrador',
  entrenador: 'Entrenador', recepcion: 'Recepción', cliente: 'Cliente',
};

export function Badge({ variant, label }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${configs[variant]}`}>
      {label ?? defaultLabels[variant]}
    </span>
  );
}
