import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { DataTable } from '../../components/DataTable';
import { DataState } from '../../components/DataState';
import { apiCobro } from '../../lib/api';

// Una reservación tal como la devuelve GET /cobro/api/reservas. Estos registros
// viven en la tabla webcobro.reservas (PostgreSQL) que alimenta el módulo de
// Cobro (front desk): aquí solo se muestran, la captura y el cobro se hacen
// en ese módulo.
interface ReservaCobro {
  id: number;
  client: string;
  type: 'cliente' | 'visitante';
  class: string;
  time: string;
  status: 'pendiente' | 'pagado' | 'asistido' | 'cancelado';
  capacityStatus: 'confirmada' | 'espera';
  horarioId?: string;
  price: number;
  // Fecha del horario reservado (YYYY-MM-DD). Viene vacia en los registros
  // antiguos, que no apuntan a ningun horario real del modulo de horarios.
  fecha?: string;
}

type FilterEstatus = 'todos' | ReservaCobro['status'] | 'espera';

const filterTabs: { value: FilterEstatus; label: string }[] = [
  { value: 'todos', label: 'Todas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'pagado', label: 'Pagadas' },
  { value: 'asistido', label: 'Asistidas' },
  { value: 'cancelado', label: 'Canceladas' },
  { value: 'espera', label: 'Lista de espera' },
];

// Los estados del módulo de cobro se pintan con las variantes visuales de la
// Badge de administrativa (confirmada / pendiente / cancelada).
const estatusBadge: Record<ReservaCobro['status'], { variant: 'confirmada' | 'pendiente' | 'cancelada'; label: string }> = {
  pendiente: { variant: 'pendiente', label: 'Pendiente' },
  pagado: { variant: 'confirmada', label: 'Pagada' },
  asistido: { variant: 'confirmada', label: 'Asistió' },
  cancelado: { variant: 'cancelada', label: 'Cancelada' },
};

export function ReservacionesPage() {
  const [reservaciones, setReservaciones] = useState<ReservaCobro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterEstatus>('todos');

  // Carga las reservaciones registradas en el módulo de cobro.
  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReservaciones(await apiCobro.get<ReservaCobro[]>('/reservas'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las reservaciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filtered = filter === 'todos'
    ? reservaciones
    : filter === 'espera'
      ? reservaciones.filter(r => r.capacityStatus === 'espera' && r.status !== 'cancelado')
      : reservaciones.filter(r => r.status === filter);
  const pendientes = reservaciones.filter(r => r.status === 'pendiente' && r.capacityStatus === 'confirmada').length;
  const enEspera = reservaciones.filter(r => r.capacityStatus === 'espera' && r.status !== 'cancelado').length;

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Reservaciones</h1>
          <p className="text-gray-500 text-sm mt-0.5">{reservaciones.length} registradas en Cobro · {pendientes} pendientes de pago · {enEspera} en espera</p>
        </div>
        <button onClick={() => void cargar()} disabled={loading}
          className="flex items-center gap-2 bg-[#111827] hover:bg-[#6B7280] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Actualizar
        </button>
      </div>

      <p className="text-xs text-gray-400 -mt-3">
        Vista de solo lectura: las reservaciones se capturan y cobran en el módulo de Cobro (recepción).
      </p>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {filterTabs.map(tab => (
          <button key={tab.value} onClick={() => setFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === tab.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <DataState loading={loading} error={error} empty={filtered.length === 0}
        emptyMessage="No hay reservaciones con este filtro" onRetry={() => void cargar()}>
        <DataTable
          data={filtered as unknown as Record<string, unknown>[]}
          searchKeys={['client', 'class'] as never[]}
          columns={[
            {
              key: 'client', header: 'Cliente',
              render: row => {
                const r = row as unknown as ReservaCobro;
                return (
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-800">{r.client}</p>
                    <Badge variant="cliente" label={r.type === 'visitante' ? 'Visitante' : 'Socio'} />
                  </div>
                );
              }
            },
            {
              key: 'class', header: 'Clase',
              render: row => {
                const r = row as unknown as ReservaCobro;
                return (
                  <div>
                    <p className="font-medium text-gray-800">{r.class}</p>
                    <p className="text-xs text-gray-400">
                      {r.fecha ? `${r.fecha} · ` : ''}Hora {r.time}
                    </p>
                  </div>
                );
              }
            },
            {
              key: 'status', header: 'Estatus',
              render: row => {
                const r = row as unknown as ReservaCobro;
                const badge = estatusBadge[r.status];
                return <Badge variant={badge.variant} label={badge.label} />;
              }
            },
            {
              key: 'capacityStatus', header: 'Cupo',
              render: row => {
                const r = row as unknown as ReservaCobro;
                return <Badge
                  variant={r.capacityStatus === 'espera' ? 'pendiente' : 'confirmada'}
                  label={r.capacityStatus === 'espera' ? 'En espera' : 'Confirmada'}
                />;
              }
            },
            {
              key: 'price', header: 'Precio',
              render: row => <span className="font-medium text-gray-800">${Number((row as unknown as ReservaCobro).price).toFixed(2)}</span>
            },
          ]}
        />
      </DataState>
    </div>
  );
}
