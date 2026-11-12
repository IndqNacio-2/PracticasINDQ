import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { api, apiCobro, apiPos } from '../../lib/api';

type Tab = 'ventas' | 'visitas' | 'asistencia' | 'inventario' | 'personal';

const tabs: { value: Tab; label: string; icon: string }[] = [
  { value: 'ventas', label: 'Ventas', icon: '💰' },
  { value: 'visitas', label: 'Visitas', icon: '📈' },
  { value: 'asistencia', label: 'Asistencia a Clases', icon: '🏋️' },
  { value: 'inventario', label: 'Inventario', icon: '📦' },
  { value: 'personal', label: 'Personal', icon: '👥' },
];

const PIE_COLORS = ['#4B5563', '#6B7280', '#9CA3AF', '#4B5563', '#6B7280'];

// Datos reales: ventas e inventario del Punto de Venta, reservaciones y checador
// de Cobro, y horarios de administrativa (ahí está el entrenador de cada clase).
interface VentaPos {
  folio: string;
  soldAt: string;
  items: { name: string; qty: number; unitPrice: number }[];
  total: number;
}
interface ProductoPos {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: string;
}
interface MermaPos {
  id: number;
  productId: number;
  quantity: number;
  reason: string;
  createdAt: string;
}
interface ReservaCobro {
  id: number;
  client: string;
  class: string;
  status: string;
  fecha?: string;
  horarioId?: string;
}
interface HorarioAdmin {
  idHorario: string;
  nombreEntrenador?: string;
}
interface RegistroAsistencia {
  id: number;
  codigo: string;
  nombre: string;
  rol: string | null;
  tipo: 'entrada' | 'salida';
  estado: string | null;
  automatica: boolean;
  fecha: string;
}
interface Fuentes {
  ventas: VentaPos[];
  productos: ProductoPos[];
  mermas: MermaPos[];
  reservas: ReservaCobro[];
  horarios: HorarioAdmin[];
  registros: RegistroAsistencia[];
}

const FUENTES_VACIAS: Fuentes = { ventas: [], productos: [], mermas: [], reservas: [], horarios: [], registros: [] };

// Los mismos nombres que muestra el módulo de Mermas.
const MOTIVO_MERMA: Record<string, string> = {
  damaged: 'Producto dañado',
  expired: 'Producto caducado',
  broken: 'Producto roto',
  'internal-use': 'Consumo interno',
  'inventory-error': 'Error de inventario',
  lost: 'Producto perdido',
  other: 'Otro motivo',
};

const dosDigitos = (n: number) => String(n).padStart(2, '0');
const fechaLocal = (d: Date) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
const horaLocal = (d: Date) => `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
const diaCorto = (iso: string) => {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
};

export function ReportesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('ventas');
  const [dateFrom, setDateFrom] = useState(() => {
    const hoy = new Date();
    return fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  });
  const [dateTo, setDateTo] = useState(() => fechaLocal(new Date()));
  const [fuentes, setFuentes] = useState<Fuentes>(FUENTES_VACIAS);
  const [fallidas, setFallidas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const ultimaCarga = useRef(0);

  const cargar = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    const carga = ++ultimaCarga.current;
    setLoading(true);
    // Si una fuente falla, las demás se siguen mostrando y se avisa cuál faltó.
    const [ventas, productos, mermas, reservas, horarios, registros] = await Promise.allSettled([
      apiPos.get<VentaPos[]>('/sales'),
      apiPos.get<ProductoPos[]>('/products'),
      apiPos.get<MermaPos[]>('/waste'),
      apiCobro.get<ReservaCobro[]>('/reservas'),
      api.get<HorarioAdmin[]>('/horarios'),
      apiCobro.get<RegistroAsistencia[]>(`/asistencia/registros?desde=${dateFrom}&hasta=${dateTo}`),
    ]);
    if (carga !== ultimaCarga.current) return;
    const valor = <T,>(r: PromiseSettledResult<T[]>): T[] => (r.status === 'fulfilled' ? r.value : []);
    setFuentes({
      ventas: valor(ventas),
      productos: valor(productos),
      mermas: valor(mermas),
      reservas: valor(reservas),
      horarios: valor(horarios),
      registros: valor(registros),
    });
    setFallidas(([
      ['ventas', ventas], ['productos', productos], ['mermas', mermas],
      ['reservaciones', reservas], ['horarios', horarios], ['checador', registros],
    ] as const).filter(([, r]) => r.status === 'rejected').map(([nombre]) => nombre));
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const enRango = useCallback((fecha?: string) => Boolean(fecha) && fecha! >= dateFrom && fecha! <= dateTo, [dateFrom, dateTo]);

  const ventasDelPeriodo = useMemo(() => fuentes.ventas
    .map(v => ({
      idVenta: v.folio,
      // En hora local, igual que las mermas y el checador: una venta de la noche
      // no debe pasar al día siguiente por la zona horaria fija del Punto de Venta.
      fecha: fechaLocal(new Date(v.soldAt)),
      total: v.total,
      productos: (v.items ?? []).map(i => ({ nombre: i.name, precio: i.unitPrice, cantidad: i.qty })),
    }))
    .filter(v => enRango(v.fecha)), [fuentes.ventas, enRango]);

  const totalVentas = ventasDelPeriodo.reduce((s, v) => s + v.total, 0);
  const ticketPromedio = ventasDelPeriodo.length ? totalVentas / ventasDelPeriodo.length : 0;

  const ventasPorProducto = ventasDelPeriodo.flatMap(v => v.productos).reduce((acc, p) => {
    acc[p.nombre] = (acc[p.nombre] ?? 0) + p.precio * p.cantidad;
    return acc;
  }, {} as Record<string, number>);

  const ventasPorProductoArray = Object.entries(ventasPorProducto).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total);

  // Una visita es la entrada de un socio registrada en el checador.
  const visitas = fuentes.registros.filter(r => r.codigo.startsWith('CLI-') && r.tipo === 'entrada' && !r.automatica);

  const ventasPorDia = useMemo(() => {
    const dias = new Map<string, { ventas: number; visitas: number }>();
    const dia = (fecha: string) => {
      if (!dias.has(fecha)) dias.set(fecha, { ventas: 0, visitas: 0 });
      return dias.get(fecha)!;
    };
    for (const v of ventasDelPeriodo) dia(v.fecha).ventas += v.total;
    for (const v of visitas) dia(fechaLocal(new Date(v.fecha))).visitas += 1;
    return [...dias.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, datos]) => ({ dia: diaCorto(fecha), ...datos }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventasDelPeriodo, fuentes.registros]);

  const totalVisitas = visitas.length;
  const diasConVisitas = ventasPorDia.filter(d => d.visitas > 0);
  const promedioVisitas = diasConVisitas.length ? Math.round(totalVisitas / diasConVisitas.length) : 0;
  const diaConMasVisitas = diasConVisitas.length
    ? diasConVisitas.reduce((m, d) => (d.visitas > m.visitas ? d : m)).dia
    : '—';

  // Asistencia a clases: reservaciones cuya asistencia ya se resolvió en el periodo.
  const entrenadorDe = new Map(fuentes.horarios.map(h => [h.idHorario, h.nombreEntrenador]));
  const asistenciaClases = fuentes.reservas
    .filter(r => enRango(r.fecha) && (r.status === 'asistido' || r.status === 'no_asistio'))
    .map(r => ({
      id: r.id,
      nombreCliente: r.client,
      clase: r.class,
      entrenador: entrenadorDe.get(r.horarioId ?? '') ?? '—',
      asistio: r.status === 'asistido',
    }));

  const asistenciaPorClase = Object.entries(
    asistenciaClases.filter(a => a.asistio).reduce((acc, a) => {
      acc[a.clase] = (acc[a.clase] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([clase, asistencias]) => ({ clase, asistencias })).sort((a, b) => b.asistencias - a.asistencias);

  const productos = fuentes.productos.map(p => ({
    idProducto: p.id,
    nombre: p.name,
    categoria: p.category,
    stock: p.stock,
    precio: p.price,
    estatus: p.status === 'active' ? 'activo' : 'inactivo',
  }));

  const nombreProducto = new Map(fuentes.productos.map(p => [p.id, p.name]));
  const mermas = fuentes.mermas
    .map(m => ({
      id: m.id,
      nombreProducto: nombreProducto.get(m.productId) ?? `Producto ${m.productId}`,
      cantidad: m.quantity,
      motivo: MOTIVO_MERMA[m.reason] ?? m.reason,
      fecha: fechaLocal(new Date(m.createdAt)),
    }))
    .filter(m => enRango(m.fecha));
  const totalMerma = mermas.reduce((s, m) => s + m.cantidad, 0);

  // Personal: una fila por empleado y día. La falta automática y la llegada
  // tardía del mismo día cuentan como una sola falta.
  const registrosPersonal = useMemo(() => {
    const TIPO: Record<string, 'asistencia' | 'retardo' | 'falta'> = {
      puntual: 'asistencia', sin_turno: 'asistencia', retardo: 'retardo', inasistencia: 'falta',
    };
    const dias = new Map<string, {
      id: string; nombreEmpleado: string; rol: string; fecha: string;
      horaEntrada: string; horaSalida: string; tipoRegistro: 'asistencia' | 'retardo' | 'falta';
    }>();
    for (const r of fuentes.registros) {
      if (!r.codigo.startsWith('EMP-')) continue;
      const momento = new Date(r.fecha);
      const fecha = fechaLocal(momento);
      const id = `${r.codigo}|${fecha}`;
      const fila = dias.get(id) ?? {
        id, nombreEmpleado: r.nombre, rol: r.rol ?? 'Empleado', fecha, horaEntrada: '', horaSalida: '', tipoRegistro: 'asistencia' as const,
      };
      if (r.automatica) {
        fila.tipoRegistro = 'falta';
      } else if (r.tipo === 'salida') {
        fila.horaSalida = horaLocal(momento);
      } else if (!fila.horaEntrada) {
        fila.horaEntrada = horaLocal(momento);
        fila.tipoRegistro = TIPO[r.estado ?? ''] ?? fila.tipoRegistro;
      }
      dias.set(id, fila);
    }
    return [...dias.values()].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.nombreEmpleado.localeCompare(b.nombreEmpleado));
  }, [fuentes.registros]);

  const asistenciaPersonal = registrosPersonal.reduce((acc, a) => {
    if (!acc[a.nombreEmpleado]) acc[a.nombreEmpleado] = { nombre: a.nombreEmpleado, rol: a.rol, asistencias: 0, retardos: 0, faltas: 0 };
    acc[a.nombreEmpleado][a.tipoRegistro === 'asistencia' ? 'asistencias' : a.tipoRegistro === 'retardo' ? 'retardos' : 'faltas']++;
    return acc;
  }, {} as Record<string, { nombre: string; rol: string; asistencias: number; retardos: number; faltas: number }>);

  const personalArray = Object.values(asistenciaPersonal);

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Reportes</h1>
          <p className="text-gray-500 text-sm mt-0.5">Análisis y estadísticas del sistema{loading ? ' · Actualizando…' : ''}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#111827]" />
          <span className="text-gray-400">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#111827]" />
        </div>
      </div>

      {fallidas.length > 0 && (
        <div className="rx-admin-alert" role="alert">
          <span>No se pudieron cargar: {fallidas.join(', ')}.</span>
          <button type="button" onClick={() => void cargar()} className="rx-admin-alert-action">Reintentar</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)}
            className={`rx-tab ${activeTab === tab.value ? 'rx-tab--active' : ''}`}>
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
              { label: 'Transacciones', value: ventasDelPeriodo.length },
              { label: 'Ticket Promedio', value: `$${ticketPromedio.toFixed(0)}` },
              { label: 'Producto Top', value: ventasPorProductoArray[0]?.nombre.split(' ').slice(0, 2).join(' ') ?? '—' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className="text-xl font-bold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Ventas por Día</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ventasPorDia} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v) => [`$${v}`, 'Ventas']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="ventas" fill="#4B5563" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Ventas por Producto</h3>
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
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Detalle de Ventas (Mayor a Menor)</h3>
              <button className="rx-btn rx-btn--outline rx-btn--sm">Exportar CSV</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Folio</th>
                <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Productos</th>
                <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Fecha</th>
                <th className="pb-3 text-right text-xs font-semibold text-gray-400 uppercase">Total</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {[...ventasDelPeriodo].sort((a, b) => b.total - a.total).map(v => (
                  <tr key={v.idVenta}>
                    <td className="py-3 font-medium text-gray-800">{v.idVenta}</td>
                    <td className="py-3 text-gray-500 text-xs max-w-xs truncate">{v.productos.map(p => p.nombre).join(', ')}</td>
                    <td className="py-3 text-gray-500">{v.fecha}</td>
                    <td className="py-3 text-right font-semibold text-gray-800">${v.total.toLocaleString()}</td>
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
              { label: 'Total Visitas', value: totalVisitas },
              { label: 'Promedio Diario', value: promedioVisitas },
              { label: 'Día con más visitas', value: diaConMasVisitas },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className="text-xl font-bold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>{s.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Visitas por Día — Septiembre</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={ventasPorDia} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="visitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6B7280" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6B7280" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="visitas" stroke="#6B7280" strokeWidth={2.5} dot={{ r: 3, fill: '#6B7280' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ASISTENCIA CLASES */}
      {activeTab === 'asistencia' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Asistencia por Clase</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={asistenciaPorClase} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="clase" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={80} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="asistencias" fill="#4B5563" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Asistencia en el periodo</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Cliente</th>
                <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Clase</th>
                <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Entrenador</th>
                <th className="pb-3 text-center text-xs font-semibold text-gray-400 uppercase">Asistió</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {asistenciaClases.map(a => (
                  <tr key={a.id}>
                    <td className="py-3 font-medium text-gray-800">{a.nombreCliente}</td>
                    <td className="py-3 text-gray-600">{a.clase}</td>
                    <td className="py-3 text-gray-500">{a.entrenador}</td>
                    <td className="py-3 text-center">
                      {a.asistio
                        ? <span className="text-[#6B7280]">✓</span>
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
              { label: 'Productos activos', value: productos.filter(p => p.estatus === 'activo').length },
              { label: 'Total unidades', value: productos.reduce((s, p) => s + p.stock, 0) },
              { label: 'Mermas registradas', value: totalMerma },
              { label: 'Valor total inventario', value: `$${productos.reduce((s, p) => s + p.stock * p.precio, 0).toLocaleString()}` },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className="text-xl font-bold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Existencias por Producto</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Producto</th>
                <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Categoría</th>
                <th className="pb-3 text-center text-xs font-semibold text-gray-400 uppercase">Stock</th>
                <th className="pb-3 text-right text-xs font-semibold text-gray-400 uppercase">Valor</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {productos.map(p => (
                  <tr key={p.idProducto}>
                    <td className="py-3 font-medium text-gray-800">{p.nombre}</td>
                    <td className="py-3 text-gray-500">{p.categoria}</td>
                    <td className="py-3 text-center">
                      <span className={p.stock <= 5 ? 'text-red-500 font-semibold' : 'text-gray-700 font-medium'}>{p.stock}</span>
                    </td>
                    <td className="py-3 text-right text-gray-700">${(p.stock * p.precio).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Mermas Registradas</h3>
            {mermas.length === 0 ? <p className="text-gray-400 text-center py-6">Sin mermas registradas</p> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Producto</th>
                  <th className="pb-3 text-center text-xs font-semibold text-gray-400 uppercase">Cantidad</th>
                  <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Motivo</th>
                  <th className="pb-3 text-right text-xs font-semibold text-gray-400 uppercase">Fecha</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {mermas.map(m => (
                    <tr key={m.id}>
                      <td className="py-3 font-medium text-gray-800">{m.nombreProducto}</td>
                      <td className="py-3 text-center text-red-500 font-semibold">-{m.cantidad}</td>
                      <td className="py-3 text-gray-500">{m.motivo}</td>
                      <td className="py-3 text-right text-gray-400">{m.fecha}</td>
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
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Asistencia del Personal</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Empleado</th>
                <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Rol</th>
                <th className="pb-3 text-center text-xs font-semibold text-gray-400 uppercase text-emerald-500">Asistencias</th>
                <th className="pb-3 text-center text-xs font-semibold text-gray-400 uppercase text-amber-500">Retardos</th>
                <th className="pb-3 text-center text-xs font-semibold text-gray-400 uppercase text-red-500">Faltas</th>
                <th className="pb-3 text-right text-xs font-semibold text-gray-400 uppercase">% Asistencia</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {personalArray.map(p => {
                  const total = p.asistencias + p.retardos + p.faltas;
                  const pct = Math.round((p.asistencias / total) * 100);
                  return (
                    <tr key={p.nombre}>
                      <td className="py-3 font-medium text-gray-800">{p.nombre}</td>
                      <td className="py-3 text-gray-500 capitalize">{p.rol}</td>
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

          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Registro de Asistencia Detallado</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Empleado</th>
                <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Fecha</th>
                <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Entrada</th>
                <th className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase">Salida</th>
                <th className="pb-3 text-center text-xs font-semibold text-gray-400 uppercase">Tipo</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {registrosPersonal.map(a => (
                  <tr key={a.id}>
                    <td className="py-3 font-medium text-gray-800">{a.nombreEmpleado}</td>
                    <td className="py-3 text-gray-500">{a.fecha}</td>
                    <td className="py-3 text-gray-600">{a.horaEntrada || '—'}</td>
                    <td className="py-3 text-gray-600">{a.horaSalida || '—'}</td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.tipoRegistro === 'asistencia' ? 'bg-[#F3F4F6] text-[#6B7280]' : a.tipoRegistro === 'retardo' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
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
