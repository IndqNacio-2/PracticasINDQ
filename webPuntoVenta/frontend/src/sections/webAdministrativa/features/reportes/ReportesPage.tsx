import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { mockVentas, mockAsistencias, mockAsistenciaClases, mockProductos, mockMovimientos, ventasPorDia, asistenciaPorClase } from '../../data/mock';

type Tab = 'ventas' | 'visitas' | 'asistencia' | 'inventario' | 'personal';

const tabs: { value: Tab; label: string; icon: string }[] = [
  { value: 'ventas', label: 'Ventas', icon: '💰' },
  { value: 'visitas', label: 'Visitas', icon: '📈' },
  { value: 'asistencia', label: 'Asistencia a Clases', icon: '🏋️' },
  { value: 'inventario', label: 'Inventario', icon: '📦' },
  { value: 'personal', label: 'Personal', icon: '👥' },
];

const PIE_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#0891b2'];

export function ReportesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('ventas');
  const [dateFrom, setDateFrom] = useState('2024-09-01');
  const [dateTo, setDateTo] = useState('2024-09-16');

  const totalVentas = mockVentas.reduce((s, v) => s + v.total, 0);
  const ticketPromedio = totalVentas / mockVentas.length;

  const ventasPorProducto = mockVentas.flatMap(v => v.productos).reduce((acc, p) => {
    acc[p.nombre] = (acc[p.nombre] ?? 0) + p.precio * p.cantidad;
    return acc;
  }, {} as Record<string, number>);

  const ventasPorProductoArray = Object.entries(ventasPorProducto).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total);

  const asistenciaPersonal = mockAsistencias.reduce((acc, a) => {
    if (!acc[a.nombreEmpleado]) acc[a.nombreEmpleado] = { nombre: a.nombreEmpleado, rol: a.rol, asistencias: 0, retardos: 0, faltas: 0 };
    acc[a.nombreEmpleado][a.tipoRegistro === 'asistencia' ? 'asistencias' : a.tipoRegistro === 'retardo' ? 'retardos' : 'faltas']++;
    return acc;
  }, {} as Record<string, { nombre: string; rol: string; asistencias: number; retardos: number; faltas: number }>);

  const personalArray = Object.values(asistenciaPersonal);

  const mermas = mockMovimientos.filter(m => m.tipo === 'merma');
  const totalMerma = mermas.reduce((s, m) => s + m.cantidad, 0);

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Reportes</h1>
          <p className="text-slate-500 text-sm mt-0.5">Análisis y estadísticas del sistema</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <span className="text-slate-400">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.value ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600'}`}>
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* VENTAS */}
      {activeTab === 'ventas' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Ventas', value: `$${totalVentas.toLocaleString()}` },
              { label: 'Transacciones', value: mockVentas.length },
              { label: 'Ticket Promedio', value: `$${ticketPromedio.toFixed(0)}` },
              { label: 'Producto Top', value: ventasPorProductoArray[0]?.nombre.split(' ').slice(0, 2).join(' ') },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className="text-xl font-bold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Ventas por Día</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ventasPorDia} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v) => [`$${v}`, 'Ventas']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="ventas" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Ventas por Producto</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={ventasPorProductoArray} dataKey="total" nameKey="nombre" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                    {ventasPorProductoArray.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`$${v}`, 'Total']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Detalle de Ventas (Mayor a Menor)</h3>
              <button className="text-xs text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-medium transition-colors">Exportar CSV</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase">Cliente</th>
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase">Productos</th>
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase">Fecha</th>
                <th className="pb-3 text-right text-xs font-semibold text-slate-400 uppercase">Total</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {[...mockVentas].sort((a, b) => b.total - a.total).map(v => (
                  <tr key={v.idVenta}>
                    <td className="py-3 font-medium text-slate-800">{v.nombreCliente}</td>
                    <td className="py-3 text-slate-500 text-xs max-w-xs truncate">{v.productos.map(p => p.nombre).join(', ')}</td>
                    <td className="py-3 text-slate-500">{v.fecha}</td>
                    <td className="py-3 text-right font-semibold text-slate-800">${v.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISITAS */}
      {activeTab === 'visitas' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Visitas (Sep)', value: ventasPorDia.reduce((s, d) => s + d.visitas, 0) },
              { label: 'Promedio Diario', value: Math.round(ventasPorDia.reduce((s, d) => s + d.visitas, 0) / ventasPorDia.length) },
              { label: 'Día con más visitas', value: ventasPorDia.reduce((m, d) => d.visitas > m.visitas ? d : m).dia },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className="text-xl font-bold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>{s.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Visitas por Día — Septiembre</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={ventasPorDia} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="visitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="visitas" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ASISTENCIA CLASES */}
      {activeTab === 'asistencia' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Asistencia por Clase</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={asistenciaPorClase} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="clase" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={80} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="asistencias" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Asistencia Hoy por Clase</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase">Cliente</th>
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase">Clase</th>
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase">Entrenador</th>
                <th className="pb-3 text-center text-xs font-semibold text-slate-400 uppercase">Asistió</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {mockAsistenciaClases.map(a => (
                  <tr key={a.id}>
                    <td className="py-3 font-medium text-slate-800">{a.nombreCliente}</td>
                    <td className="py-3 text-slate-600">{a.clase}</td>
                    <td className="py-3 text-slate-500">{a.entrenador}</td>
                    <td className="py-3 text-center">
                      {a.asistio
                        ? <span className="text-emerald-600">✓</span>
                        : <span className="text-red-400">✗</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INVENTARIO */}
      {activeTab === 'inventario' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Productos activos', value: mockProductos.filter(p => p.estatus === 'activo').length },
              { label: 'Total unidades', value: mockProductos.reduce((s, p) => s + p.stock, 0) },
              { label: 'Mermas registradas', value: totalMerma },
              { label: 'Valor total inventario', value: `$${mockProductos.reduce((s, p) => s + p.stock * p.precio, 0).toLocaleString()}` },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className="text-xl font-bold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Existencias por Producto</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase">Producto</th>
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase">Categoría</th>
                <th className="pb-3 text-center text-xs font-semibold text-slate-400 uppercase">Stock</th>
                <th className="pb-3 text-right text-xs font-semibold text-slate-400 uppercase">Valor</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {mockProductos.map(p => (
                  <tr key={p.idProducto}>
                    <td className="py-3 font-medium text-slate-800">{p.nombre}</td>
                    <td className="py-3 text-slate-500">{p.categoria}</td>
                    <td className="py-3 text-center">
                      <span className={p.stock <= 5 ? 'text-red-500 font-semibold' : 'text-slate-700 font-medium'}>{p.stock}</span>
                    </td>
                    <td className="py-3 text-right text-slate-700">${(p.stock * p.precio).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Mermas Registradas</h3>
            {mermas.length === 0 ? <p className="text-slate-400 text-center py-6">Sin mermas registradas</p> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100">
                  <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase">Producto</th>
                  <th className="pb-3 text-center text-xs font-semibold text-slate-400 uppercase">Cantidad</th>
                  <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase">Motivo</th>
                  <th className="pb-3 text-right text-xs font-semibold text-slate-400 uppercase">Fecha</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {mermas.map(m => (
                    <tr key={m.id}>
                      <td className="py-3 font-medium text-slate-800">{m.nombreProducto}</td>
                      <td className="py-3 text-center text-red-500 font-semibold">-{m.cantidad}</td>
                      <td className="py-3 text-slate-500">{m.motivo}</td>
                      <td className="py-3 text-right text-slate-400">{m.fecha}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* PERSONAL */}
      {activeTab === 'personal' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Asistencia del Personal</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase">Empleado</th>
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase">Rol</th>
                <th className="pb-3 text-center text-xs font-semibold text-slate-400 uppercase text-emerald-500">Asistencias</th>
                <th className="pb-3 text-center text-xs font-semibold text-slate-400 uppercase text-amber-500">Retardos</th>
                <th className="pb-3 text-center text-xs font-semibold text-slate-400 uppercase text-red-500">Faltas</th>
                <th className="pb-3 text-right text-xs font-semibold text-slate-400 uppercase">% Asistencia</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {personalArray.map(p => {
                  const total = p.asistencias + p.retardos + p.faltas;
                  const pct = Math.round((p.asistencias / total) * 100);
                  return (
                    <tr key={p.nombre}>
                      <td className="py-3 font-medium text-slate-800">{p.nombre}</td>
                      <td className="py-3 text-slate-500 capitalize">{p.rol}</td>
                      <td className="py-3 text-center text-emerald-600 font-semibold">{p.asistencias}</td>
                      <td className="py-3 text-center text-amber-500 font-semibold">{p.retardos}</td>
                      <td className="py-3 text-center text-red-500 font-semibold">{p.faltas}</td>
                      <td className="py-3 text-right">
                        <span className={`font-semibold ${pct >= 90 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-500' : 'text-red-500'}`}>{pct}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Registro de Asistencia Detallado</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase">Empleado</th>
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase">Fecha</th>
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase">Entrada</th>
                <th className="pb-3 text-left text-xs font-semibold text-slate-400 uppercase">Salida</th>
                <th className="pb-3 text-center text-xs font-semibold text-slate-400 uppercase">Tipo</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {mockAsistencias.map(a => (
                  <tr key={a.id}>
                    <td className="py-3 font-medium text-slate-800">{a.nombreEmpleado}</td>
                    <td className="py-3 text-slate-500">{a.fecha}</td>
                    <td className="py-3 text-slate-600">{a.horaEntrada || '—'}</td>
                    <td className="py-3 text-slate-600">{a.horaSalida || '—'}</td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.tipoRegistro === 'asistencia' ? 'bg-emerald-50 text-emerald-700' : a.tipoRegistro === 'retardo' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
                        {a.tipoRegistro}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
