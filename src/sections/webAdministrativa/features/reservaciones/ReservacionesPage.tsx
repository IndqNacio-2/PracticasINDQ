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
  clienteId: number | null;
  paymentStatus: 'pendiente' | 'pagado';
  attendanceStatus: 'pendiente' | 'asistido' | 'no_asistio';
  type: 'cliente' | 'visitante';
  class: string;
  time: string;
  status: 'pendiente' | 'pagado' | 'asistido' | 'cancelado' | 'no_asistio';
  capacityStatus: 'confirmada' | 'espera';
  codigo?: string;
  reagendada?: boolean;
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
  { value: 'no_asistio', label: 'No asistió' },
  { value: 'espera', label: 'Lista de espera' },
];

// Los estados del módulo de cobro se pintan con las variantes visuales de la
// Badge de administrativa (confirmada / pendiente / cancelada).
const estatusBadge: Record<ReservaCobro['status'], { variant: 'confirmada' | 'pendiente' | 'cancelada'; label: string }> = {
  pendiente: { variant: 'pendiente', label: 'Pendiente' },
  pagado: { variant: 'confirmada', label: 'Pagada' },
  asistido: { variant: 'confirmada', label: 'Asistió' },
  cancelado: { variant: 'cancelada', label: 'Cancelada' },
  no_asistio: { variant: 'cancelada', label: 'No asistió' },
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
      : reservaciones.filter(r => filter === 'pagado' ? r.paymentStatus === 'pagado' : r.status === filter);
  const pendientes = reservaciones.filter(r => r.paymentStatus === 'pendiente' && r.status === 'pendiente' && r.capacityStatus === 'confirmada').length;
  const enEspera = reservaciones.filter(r => r.capacityStatus === 'espera' && r.status !== 'cancelado').length;

  return (
    <div className="rx-admin-module rx-admin-reservations">
      <header className="rx-page-header rx-module-header">
        <div>
          <h1 className="rx-page-title">Reservaciones</h1>
          <p className="rx-page-subtitle">{reservaciones.length} registradas en Cobro · {pendientes} pendientes de pago · {enEspera} en espera</p>
        </div>
        <div className="rx-module-header-actions">
          <button onClick={() => void cargar()} disabled={loading}
            className="rx-btn rx-btn--outline">
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Actualizar
          </button>
        </div>
      </header>

      <div className="rx-admin-module-content space-y-5">
      <p className="text-xs text-[color:var(--rx-ink-muted)] -mt-3">
        Vista de solo lectura: las reservaciones se capturan y cobran en el módulo de Cobro (recepción).
      </p>

      <div className="flex gap-1 bg-[var(--rx-surface-soft)] p-1 rounded-[var(--rx-radius-medium)] w-fit">
        {filterTabs.map(tab => (
          <button key={tab.value} onClick={() => setFilter(tab.value)}
            className={`rx-tab ${filter === tab.value ? 'rx-tab--active' : ''}`}>
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
                    <p className="font-medium text-[color:var(--rx-ink)]">{r.client} {r.clienteId ? `#${r.clienteId}` : ''}</p>
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
                    <p className="font-medium text-[color:var(--rx-ink)]">{r.class}</p>
                    <p className="text-xs text-[color:var(--rx-ink-muted)]">
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
                const badge = estatusBadge[r.status] ?? { variant: 'pendiente' as const, label: r.status };
                return <div className="space-y-1"><Badge variant={badge.variant} label={badge.label} />
                  <p className="text-xs text-[color:var(--rx-ink-secondary)]">{r.paymentStatus === 'pagado' ? 'Pago registrado' : 'Pago pendiente'} · {r.attendanceStatus === 'pendiente' ? 'Asistencia pendiente' : r.attendanceStatus === 'asistido' ? 'Asistio' : 'No asistio'}</p>
                </div>;
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
              render: row => <span className="font-medium text-[color:var(--rx-ink)]">${Number((row as unknown as ReservaCobro).price).toFixed(2)}</span>
            },
          ]}
        />
      </DataState>
      </div>
    </div>
  );
}
