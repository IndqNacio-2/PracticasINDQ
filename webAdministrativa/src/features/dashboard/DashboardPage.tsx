import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { StatCard } from '../../components/StatCard';
import { Badge } from '../../components/Badge';
import { mockClientes, mockReservaciones, mockVentas, mockHorarios, ventasPorDia } from '../../data/mock';

export function DashboardPage() {
  const activeClients = mockClientes.filter(c => c.estatus === 'activo').length;
  const todayReservations = mockReservaciones.filter(r => r.fechaReservacion === '2024-09-16').length;
  const monthRevenue = mockVentas.reduce((s, v) => s + v.total, 0);
  const todayClasses = mockHorarios.filter(h => h.fecha === '2024-09-16').length;

  const pendingReservations = mockReservaciones.filter(r => r.estatus === 'pendiente').slice(0, 5);
  const recentVentas = mockVentas.slice(-4).reverse();

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Panel de Control</h1>
        <p className="text-slate-500 text-sm mt-0.5">Lunes 16 de septiembre, 2024</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Clientes Activos"
          value={activeClients}
          trend={{ value: '12%', positive: true }}
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatCard
          label="Reservaciones Hoy"
          value={todayReservations}
          trend={{ value: '8%', positive: true }}
          accent="#6366f1"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
        />
        <StatCard
          label="Ingresos del Mes"
          value={`$${monthRevenue.toLocaleString()}`}
          trend={{ value: '23%', positive: true }}
          accent="#f59e0b"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Clases Hoy"
          value={todayClasses}
          trend={{ value: '5%', positive: false }}
          accent="#ec4899"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Ventas e Ingresos — Septiembre</h3>
            <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">2024</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={ventasPorDia} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="venGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v) => [`$${v}`, 'Ventas']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Area type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={2} fill="url(#venGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Visitas Diarias</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ventasPorDia.slice(-7)} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="visitas" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Clases de hoy */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Clases de Hoy</h3>
          <div className="space-y-2">
            {mockHorarios.filter(h => h.fecha === '2024-09-16').map(h => {
              const pct = Math.round(((h.capacidadTotal - h.capacidadDisponible) / h.capacidadTotal) * 100);
              return (
                <div key={h.idHorario} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10 flex-shrink-0">
                    <span className="text-xs font-bold text-emerald-700">{h.horaInicio.split(':')[0]}h</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{h.nombreClase}</p>
                    <p className="text-xs text-slate-400">{h.nombreEntrenador} · {h.salon}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-medium text-slate-700">{h.capacidadTotal - h.capacidadDisponible}/{h.capacidadTotal}</p>
                    <div className="w-16 h-1.5 bg-slate-200 rounded-full mt-1">
                      <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reservaciones pendientes */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Reservaciones Pendientes</h3>
          <div className="space-y-2">
            {pendingReservations.map(r => (
              <div key={r.idReservacion} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-slate-800">{r.nombreCliente}</p>
                  <p className="text-xs text-slate-400">{r.clase} · {r.horaClase}</p>
                </div>
                <Badge variant={r.estatus} />
              </div>
            ))}
            {pendingReservations.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Sin reservaciones pendientes</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent sales */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <h3 className="font-semibold text-slate-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Ventas Recientes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Cliente</th>
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Productos</th>
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Fecha</th>
                <th className="pb-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentVentas.map(v => (
                <tr key={v.idVenta}>
                  <td className="py-3 font-medium text-slate-800">{v.nombreCliente}</td>
                  <td className="py-3 text-slate-500 truncate max-w-xs">{v.productos.map(p => p.nombre).join(', ')}</td>
                  <td className="py-3 text-slate-500">{v.fecha}</td>
                  <td className="py-3 text-right font-semibold text-slate-800">${v.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
