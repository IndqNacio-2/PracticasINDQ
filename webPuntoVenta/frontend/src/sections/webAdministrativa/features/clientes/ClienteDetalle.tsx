import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Badge } from '../../components/Badge';
import { DataState } from '../../components/DataState';
import { apiCobro } from '../../lib/api';
import { MembresiasCliente, type MembresiaComprada } from './MembresiasCliente';

type Tab = 'general' | 'membresia' | 'historial';

const tabs: { value: Tab; label: string }[] = [
  { value: 'general', label: 'Datos Generales' },
  { value: 'membresia', label: 'Membresía' },
  { value: 'historial', label: 'Historial' },
];

// Socio tal como lo devuelve GET /cobro/api/clientes.
interface SocioCobro {
  id: number;
  nombre: string;
  membresia?: string;
  telefono: string;
  correo: string | null;
  activo: boolean;
  vigencia_hasta?: string | null;
  membresiasCompradas?: MembresiaComprada[];
}

// Reservación tal como la devuelve GET /cobro/api/reservas.
interface ReservaCobro {
  id: number;
  client: string;
  type: 'cliente' | 'visitante';
  clienteId?: number | null;
  class: string;
  time: string;
  status: 'pendiente' | 'pagado' | 'asistido' | 'cancelado' | 'no_asistio';
  fecha?: string;
  codigo?: string;
  price: number;
}

const estatusReserva: Record<ReservaCobro['status'], { variant: 'confirmada' | 'pendiente' | 'cancelada'; label: string }> = {
  pendiente: { variant: 'pendiente', label: 'Pendiente' },
  pagado: { variant: 'confirmada', label: 'Pagada' },
  asistido: { variant: 'confirmada', label: 'Asistió' },
  cancelado: { variant: 'cancelada', label: 'Cancelada' },
  no_asistio: { variant: 'cancelada', label: 'No asistió' },
};

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right max-w-xs">{value || '—'}</span>
    </div>
  );
}

export function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [socio, setSocio] = useState<SocioCobro | null>(null);
  const [reservas, setReservas] = useState<ReservaCobro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [socios, todas] = await Promise.all([
        apiCobro.get<SocioCobro[]>('/clientes'),
        apiCobro.get<ReservaCobro[]>('/reservas'),
      ]);
      const encontrado = socios.find(s => String(s.id) === id) ?? null;
      setSocio(encontrado);
      // Las reservaciones viejas no tienen ID de socio: se comparan por nombre.
      setReservas(encontrado
        ? todas
          .filter(r => (r.clienteId ? r.clienteId === encontrado.id : r.type === 'cliente' && r.client === encontrado.nombre))
          .sort((a, b) => `${b.fecha ?? ''} ${b.time}`.localeCompare(`${a.fecha ?? ''} ${a.time}`))
        : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el cliente.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (loading || error) return <DataState loading={loading} error={error} onRetry={() => void cargar()} />;

  if (!socio) return (
    <div className="text-center py-20 text-gray-400">
      <p className="text-lg">Cliente no encontrado</p>
      <button onClick={() => navigate('/clientes')} className="rx-btn rx-btn--outline mt-4">← Volver a clientes</button>
    </div>
  );

  const estatus = socio.activo ? 'activo' : 'inactivo';

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Encabezado */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/clientes')} className="rx-icon-btn" aria-label="Volver a clientes">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>{socio.nombre}</h1>
          <p className="text-gray-500 text-sm">Expediente de cliente · ID {socio.id}</p>
        </div>
      </div>

      {/* Tarjeta de perfil */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>{socio.nombre}</h2>
          <Badge variant={estatus} />
        </div>
        <p className="text-gray-500 text-sm mt-1">{socio.correo || 'Sin correo'} · {socio.telefono || 'Sin teléfono'}</p>
      </div>

      {/* Pestañas */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.value} onClick={() => setActiveTab(tab.value)}
              className={`rx-tab ${activeTab === tab.value ? 'rx-tab--active' : ''}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="max-w-xl">
              <InfoRow label="Nombre completo" value={socio.nombre} />
              <InfoRow label="Correo electrónico" value={socio.correo} />
              <InfoRow label="Teléfono" value={socio.telefono} />
              <InfoRow label="ID Cliente" value={socio.id} />
              <InfoRow label="Plan" value={socio.membresia} />
              <InfoRow label="Vigencia" value={socio.vigencia_hasta} />
              <InfoRow label="Estatus" value={estatus} />
            </div>
          )}

          {activeTab === 'membresia' && <MembresiasCliente compras={socio.membresiasCompradas} />}

          {activeTab === 'historial' && (
            reservas.length === 0
              ? <p className="text-gray-400 text-center py-6">Sin reservaciones registradas</p>
              : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100">
                    <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Fecha</th>
                    <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Hora</th>
                    <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Clase</th>
                    <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Código</th>
                    <th className="pb-3 text-center text-xs font-semibold text-gray-400 uppercase">Estatus</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {reservas.map(r => {
                      const badge = estatusReserva[r.status] ?? { variant: 'pendiente' as const, label: r.status };
                      return (
                        <tr key={r.id}>
                          <td className="py-3 text-gray-600">{r.fecha || '—'}</td>
                          <td className="py-3 text-gray-600">{r.time}</td>
                          <td className="py-3 font-medium text-gray-800">{r.class}</td>
                          <td className="py-3 text-gray-500">{r.codigo || '—'}</td>
                          <td className="py-3 text-center"><Badge variant={badge.variant} label={badge.label} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
          )}
        </div>
      </div>
    </div>
  );
}
