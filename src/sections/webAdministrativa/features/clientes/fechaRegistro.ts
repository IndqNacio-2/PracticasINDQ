export function formatearFechaRegistro(valor?: string | null): string {
  if (!valor) return 'No disponible';
  // Las fechas históricas sin hora representan un día, no un instante UTC.
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const fecha = new Date(soloFecha ? `${valor}T12:00:00` : valor);
  if (Number.isNaN(fecha.getTime())) return 'No disponible';
  return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}