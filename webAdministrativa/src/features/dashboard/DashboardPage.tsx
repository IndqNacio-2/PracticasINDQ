import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { StatCard } from '../../components/StatCard';
import { Badge } from '../../components/Badge';
import { DataState } from '../../components/DataState';
import { api, mensajeDeError } from '../../lib/api';
import type { Cliente, Reservacion, HorarioClase, Venta, RegistroAsistencia } from '../../types';

const DIAS_GRAFICA = 7;

// Fecha YYYY-MM-DD en la hora local del navegador (toISOString() usa UTC y de noche marca el día siguiente)
const fechaLocal = (d: Date) => d.toLocaleDateString('en-CA');

// Últimos N días, de más antiguo a más reciente
function ultimosDias(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return fechaLocal(d);
  });
}

const etiquetaDia = (fecha: string) => {
  const [, m, d] = fecha.split('-');
  return `${d}/${m}`;
};

export function DashboardPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [reservaciones, setReservaciones] = useState<Reservacion[]>([]);
  const [horarios, setHorarios] = useState<HorarioClase[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  // Las visitas solo las puede consultar administración y recepción; para otros roles queda vacío
  const [visitas, setVisitas] = useState<RegistroAsistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const desde = ultimosDias(DIAS_GRAFICA)[0];
      const [clientesData, reservacionesData, horariosData, ventasData, visitasData] = await Promise.all([
        api.get<Cliente[]>('/clientes'),
        api.get<Reservacion[]>('/reservaciones'),
        api.get<HorarioClase[]>('/horarios'),
        api.get<Venta[]>('/ventas'),
        api.get<RegistroAsistencia[]>(`/asistencia?tipoPersona=cliente&desde=${desde}`).catch(() => [] as RegistroAsistencia[]),
      ]);
      setClientes(clientesData);
      setReservaciones(reservacionesData);
      setHorarios(horariosData);
      setVentas(ventasData);
      setVisitas(visitasData);
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo cargar el panel de control.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const hoy = fechaLocal(new Date());
  const ventasValidas = ventas.filter(v => v.estatus !== 'cancelada');

  const activeClients = clientes.filter(c => c.estatus === 'activo').length;
  // Reservaciones para clases de hoy (sin contar canceladas)
  const todayReservations = reservaciones.filter(r => r.fechaClase === hoy && r.estatus !== 'cancelada').length;
  const totalRevenue = ventasValidas.reduce((s, v) => s + v.total, 0);
  const todaySchedule = horarios.filter(h => h.fecha === hoy && h.estatus === 'activo');
  const todayClasses = todaySchedule.length;

  const pendingReservations = reservaciones.filter(r => r.estatus === 'pendiente').slice(0, 5);
  const recentVentas = [...ventasValidas]
    .sort((a, b) => `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`))
    .slice(0, 4);

  // Series de las gráficas: últimos 7 días, con 0 en los días sin movimiento
  const dias = ultimosDias(DIAS_GRAFICA);
  const ventasPorDia = dias.map(fecha => ({
    dia: etiquetaDia(fecha),
    ventas: ventasValidas.filter(v => v.fecha === fecha).reduce((s, v) => s + v.total, 0),
  }));
  const visitasPorDia = dias.map(fecha => ({
    dia: etiquetaDia(fecha),
    visitas: visitas.filter(v => v.fecha === fecha).length,
  }));

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--ink)]">Panel de Control</h1>
        <p className="text-[color:var(--ink2)] text-sm mt-0.5">
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <DataState loading={loading} error={error} onRetry={load}>
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Clientes Activos"
              value={activeClients}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            />
            <StatCard
              label="Reservaciones Hoy"
              value={todayReservations}
              accent="#16181D"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
            />
            <StatCard
              label="Ingresos Totales"
              value={`$${totalRevenue.toLocaleString()}`}
              accent="#E8803A"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatCard
              label="Clases Hoy"
              value={todayClasses}
              accent="#5B3FB0"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-[color:var(--line)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[color:var(--ink)]">Ventas e Ingresos</h3>
                <span className="text-xs text-[color:var(--ink3)]">Últimos {DIAS_GRAFICA} días</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={ventasPorDia} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="venGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2E9E5B" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2E9E5B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E4DE" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#9298A3' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9298A3' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v) => [`$${v}`, 'Ventas']} contentStyle={{ borderRadius: 12, border: '1px solid #E6E4DE', fontSize: 12 }} />
                  <Area type="monotone" dataKey="ventas" stroke="#2E9E5B" strokeWidth={2} fill="url(#venGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-[color:var(--line)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[color:var(--ink)]">Visitas Diarias</h3>
                <span className="text-xs text-[color:var(--ink3)]">Últimos {DIAS_GRAFICA} días</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={visitasPorDia} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E4DE" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#9298A3' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9298A3' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E6E4DE', fontSize: 12 }} />
                  <Bar dataKey="visitas" fill="#16181D" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tables row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-[color:var(--line)]">
              <h3 className="font-semibold text-[color:var(--ink)] mb-4">Clases de Hoy</h3>
              <div className="space-y-2">
                {todaySchedule.map(h => {
                  const pct = h.capacidadTotal > 0 ? Math.round(((h.capacidadTotal - h.capacidadDisponible) / h.capacidadTotal) * 100) : 0;
                  return (
                    <div key={h.idHorario} className="flex items-center gap-3 p-3 bg-white border border-[color:var(--line)] rounded-2xl">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[color:var(--ok-bg)] flex-shrink-0">
                        <span className="text-xs font-bold text-[color:var(--ok-ink)]">{h.horaInicio.split(':')[0]}h</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[color:var(--ink)] truncate">{h.nombreClase}</p>
                        <p className="text-xs text-[color:var(--ink3)]">{h.nombreEntrenador} · {h.salon}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-medium text-[color:var(--ink)]">{h.capacidadTotal - h.capacidadDisponible}/{h.capacidadTotal}</p>
                        <div className="w-16 h-1.5 bg-[color:var(--line)] rounded-full mt-1">
                          <div className="h-1.5 rounded-full bg-[color:var(--ok)] transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {todaySchedule.length === 0 && (
                  <p className="text-sm text-[color:var(--ink3)] text-center py-8">Sin clases programadas hoy</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-[color:var(--line)]">
              <h3 className="font-semibold text-[color:var(--ink)] mb-4">Reservaciones Pendientes</h3>
              <div className="space-y-2">
                {pendingReservations.map(r => (
                  <div key={r.idReservacion} className="flex items-center justify-between p-3 bg-white border border-[color:var(--line)] rounded-2xl">
                    <div>
                      <p className="text-sm font-medium text-[color:var(--ink)]">{r.nombreCliente}</p>
                      <p className="text-xs text-[color:var(--ink3)]">{r.clase} · {r.horaClase}</p>
                    </div>
                    <Badge variant={r.estatus} />
                  </div>
                ))}
                {pendingReservations.length === 0 && (
                  <p className="text-sm text-[color:var(--ink3)] text-center py-8">Sin reservaciones pendientes</p>
                )}
              </div>
            </div>
          </div>

          {/* Recent sales */}
          <div className="bg-white rounded-2xl p-5 border border-[color:var(--line)]">
            <h3 className="font-semibold text-[color:var(--ink)] mb-4">Ventas Recientes</h3>
            {recentVentas.length === 0 ? (
              <p className="text-sm text-[color:var(--ink3)] text-center py-8">Sin ventas registradas todavía</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="rowtable text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">Cliente</th>
                      <th className="text-left">Productos</th>
                      <th className="text-left">Fecha</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentVentas.map(v => (
                      <tr key={v.idVenta}>
                        <td className="py-3 font-medium text-[color:var(--ink)]">{v.nombreCliente}</td>
                        <td className="py-3 text-[color:var(--ink2)] truncate max-w-xs">{v.productos.map(p => p.nombre).join(', ')}</td>
                        <td className="py-3 text-[color:var(--ink2)]">{v.fecha} {v.hora}</td>
                        <td className="py-3 text-right font-semibold text-[color:var(--ink)]">${v.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DataState>
    </div>
  );
}