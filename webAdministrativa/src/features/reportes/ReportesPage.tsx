import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { DataState } from '../../components/DataState';
import { api, buildQuery, mensajeDeError } from '../../lib/api';
import type {
  ReporteVentas, ReporteVisitas, ReporteAsistenciaClases, ReporteInventario, ReportePersonal,
} from '../../types';

type Tab = 'ventas' | 'visitas' | 'asistencia' | 'inventario' | 'personal';
type PorAsistencia = 'clase' | 'entrenador';
type OrdenPrecio = 'asc' | 'desc';

const tabs: { value: Tab; label: string; icon: string }[] = [
  { value: 'ventas', label: 'Ventas', icon: '💰' },
  { value: 'visitas', label: 'Visitas', icon: '📈' },
  { value: 'asistencia', label: 'Asistencia a Clases', icon: '🏋️' },
  { value: 'inventario', label: 'Inventario', icon: '📦' },
  { value: 'personal', label: 'Personal', icon: '👥' },
];

const PIE_COLORS = ['#2E9E5B', '#16181D', '#E8803A', '#5B3FB0', '#2459A3', '#D64545', '#9298A3', '#C6F24E'];
const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #E6E4DE', fontSize: 12 } as const;
const AXIS_TICK = { fontSize: 10, fill: '#9298A3' } as const;
const TH = '';

const dinero = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;

/* ───────────── Subcomponentes ───────────── */

function StatCards({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className={`grid grid-cols-2 ${items.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-4`}>
      {items.map(s => (
        <div key={s.label} className="bg-white rounded-2xl p-4 border border-[color:var(--line)]">
          <p className="text-xs text-[color:var(--ink2)] mb-1">{s.label}</p>
          <p className="text-xl font-bold text-[color:var(--ink)] truncate">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function Card({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[color:var(--line)]">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="font-semibold text-[color:var(--ink)]">{title}</h3>
        {actions}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${value === o.value ? 'bg-[color:var(--dark)] text-white border-[color:var(--dark)]' : 'bg-white text-[color:var(--ink)] border-[color:var(--line)] hover:border-[color:var(--ink3)]'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className="text-[color:var(--ink3)] text-center py-8 text-sm">{children}</p>;
}

/* ───────────── Página ───────────── */

export function ReportesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('ventas');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [porAsistencia, setPorAsistencia] = useState<PorAsistencia>('clase');
  const [ordenPrecio, setOrdenPrecio] = useState<OrdenPrecio>('desc');

  const [ventas, setVentas] = useState<ReporteVentas | null>(null);
  const [visitas, setVisitas] = useState<ReporteVisitas | null>(null);
  const [asistencia, setAsistencia] = useState<ReporteAsistenciaClases | null>(null);
  const [inventario, setInventario] = useState<ReporteInventario | null>(null);
  const [personal, setPersonal] = useState<ReportePersonal | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Solo se pide el reporte de la pestaña activa, con el rango de fechas elegido
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const rango = { desde: dateFrom, hasta: dateTo };
    try {
      switch (activeTab) {
        case 'ventas':
          setVentas(await api.get<ReporteVentas>(`/reportes/ventas${buildQuery(rango)}`));
          break;
        case 'visitas':
          setVisitas(await api.get<ReporteVisitas>(`/reportes/visitas${buildQuery(rango)}`));
          break;
        case 'asistencia':
          setAsistencia(await api.get<ReporteAsistenciaClases>(`/reportes/asistencia-clases${buildQuery({ ...rango, por: porAsistencia })}`));
          break;
        case 'inventario':
          setInventario(await api.get<ReporteInventario>(`/reportes/inventario${buildQuery(rango)}`));
          break;
        case 'personal':
          setPersonal(await api.get<ReportePersonal>(`/reportes/personal${buildQuery(rango)}`));
          break;
      }
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudieron cargar los reportes.'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateFrom, dateTo, porAsistencia]);

  useEffect(() => { load(); }, [load]);

  const productosOrdenados = ventas
    ? [...ventas.productosPorPrecio].sort((a, b) => (ordenPrecio === 'asc' ? a.precio - b.precio : b.precio - a.precio))
    : [];

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--ink)]">Reportes</h1>
          <p className="text-[color:var(--ink2)] text-sm mt-0.5">Análisis y estadísticas del sistema</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border border-[color:var(--line)] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)]" />
          <span className="text-[color:var(--ink3)]">—</span>
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border border-[color:var(--line)] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)]" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-[color:var(--ink2)] hover:text-[color:var(--ink)]">Limpiar</button>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors border ${activeTab === tab.value ? 'bg-[color:var(--dark)] text-white border-[color:var(--dark)]' : 'bg-white border-[color:var(--line)] text-[color:var(--ink)] hover:border-[color:var(--ink3)]'}`}>
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <DataState loading={loading} error={error} onRetry={load}>
        {/* ───────── VENTAS ───────── */}
        {activeTab === 'ventas' && ventas && (
          ventas.resumen.transacciones === 0 ? (
            <Vacio>Sin ventas registradas en este rango de fechas</Vacio>
          ) : (
            <div className="space-y-4">
              <StatCards items={[
                { label: 'Total Ventas', value: dinero(ventas.resumen.total) },
                { label: 'Transacciones', value: ventas.resumen.transacciones },
                { label: 'Ticket Promedio', value: dinero(ventas.resumen.ticketPromedio) },
                { label: 'Producto Top', value: ventas.resumen.productoTop || '—' },
              ]} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Ventas por Día">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={ventas.porDia} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E4DE" />
                      <XAxis dataKey="fecha" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                      <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v) => [dinero(Number(v)), 'Total']} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="total" fill="#2E9E5B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <Card title="Ventas por Horario">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={ventas.porHorario} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E4DE" />
                      <XAxis dataKey="hora" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                      <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v) => [dinero(Number(v)), 'Total']} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="total" fill="#16181D" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              <Card title="Ventas por Tipo de Producto">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={ventas.porCategoria} dataKey="total" nameKey="categoria" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                      {ventas.porCategoria.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [dinero(Number(v)), 'Total']} contentStyle={TOOLTIP_STYLE} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              <Card
                title={ordenPrecio === 'asc' ? 'Productos por Precio (Menor a Mayor)' : 'Productos por Precio (Mayor a Menor)'}
                actions={<Segmented value={ordenPrecio} onChange={setOrdenPrecio} options={[{ value: 'desc', label: 'Mayor a menor' }, { value: 'asc', label: 'Menor a mayor' }]} />}
              >
                <table className="rowtable text-sm">
                  <thead><tr>
                    <th className={`${TH} text-left`}>Producto</th>
                    <th className={`${TH} text-left`}>Tipo</th>
                    <th className={`${TH} text-right`}>Precio</th>
                    <th className={`${TH} text-center`}>Unidades</th>
                    <th className={`${TH} text-right`}>Total</th>
                  </tr></thead>
                  <tbody>
                    {productosOrdenados.map(p => (
                      <tr key={p.idProducto}>
                        <td className="py-3 font-medium text-[color:var(--ink)]">{p.nombre}</td>
                        <td className="py-3 text-[color:var(--ink2)]">{p.categoria}</td>
                        <td className="py-3 text-right text-[color:var(--ink)]">{dinero(p.precio)}</td>
                        <td className="py-3 text-center text-[color:var(--ink2)]">{p.unidades}</td>
                        <td className="py-3 text-right font-semibold text-[color:var(--ink)]">{dinero(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )
        )}

        {/* ───────── VISITAS ───────── */}
        {activeTab === 'visitas' && visitas && (
          visitas.resumen.total === 0 ? (
            <Vacio>Sin visitas registradas en este rango de fechas</Vacio>
          ) : (
            <div className="space-y-4">
              <StatCards items={[
                { label: 'Total Visitas', value: visitas.resumen.total },
                { label: 'Promedio Diario', value: visitas.resumen.promedioDiario },
                { label: 'Día con más visitas', value: visitas.resumen.diaTop || '—' },
              ]} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Visitas por Día">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={visitas.porDia} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E4DE" />
                      <XAxis dataKey="fecha" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="visitas" stroke="#16181D" strokeWidth={2.5} dot={{ r: 3, fill: '#16181D' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="Visitas por Horario">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={visitas.porHorario} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E4DE" />
                      <XAxis dataKey="hora" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="visitas" fill="#E8803A" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            </div>
          )
        )}

        {/* ───────── ASISTENCIA A CLASES ───────── */}
        {activeTab === 'asistencia' && asistencia && (
          <div className="space-y-4">
            <Segmented value={porAsistencia} onChange={setPorAsistencia} options={[{ value: 'clase', label: 'Por clase' }, { value: 'entrenador', label: 'Por entrenador' }]} />

            {asistencia.filas.length === 0 ? (
              <Vacio>Sin reservaciones de clases en este rango de fechas</Vacio>
            ) : (
              <>
                <StatCards items={[
                  { label: 'Reservaciones', value: asistencia.resumen.reservaciones },
                  { label: 'Asistencias', value: asistencia.resumen.asistencias },
                  { label: '% Asistencia', value: `${asistencia.resumen.porcentaje}%` },
                ]} />

                <Card title={porAsistencia === 'clase' ? 'Asistencia por Clase' : 'Asistencia por Entrenador'}>
                  <ResponsiveContainer width="100%" height={Math.max(200, asistencia.filas.length * 44)}>
                    <BarChart data={asistencia.filas} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E4DE" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11, fill: '#5B606B' }} tickLine={false} axisLine={false} width={110} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="asistencias" name="Asistencias" fill="#2E9E5B" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="ausencias" name="Ausencias" fill="#D64545" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <Card title="Detalle">
                  <table className="rowtable text-sm">
                    <thead><tr>
                      <th className={`${TH} text-left`}>{porAsistencia === 'clase' ? 'Clase' : 'Entrenador'}</th>
                      <th className={`${TH} text-center`}>Reservaciones</th>
                      <th className={`${TH} text-center`}>Asistencias</th>
                      <th className={`${TH} text-center`}>Ausencias</th>
                      <th className={`${TH} text-right`}>% Asistencia</th>
                    </tr></thead>
                    <tbody>
                      {asistencia.filas.map(f => (
                        <tr key={f.nombre}>
                          <td className="py-3 font-medium text-[color:var(--ink)]">{f.nombre}</td>
                          <td className="py-3 text-center text-[color:var(--ink2)]">{f.reservaciones}</td>
                          <td className="py-3 text-center text-[color:var(--ok)] font-semibold">{f.asistencias}</td>
                          <td className="py-3 text-center text-[color:var(--bad)] font-semibold">{f.ausencias}</td>
                          <td className="py-3 text-right">
                            <span className={`font-semibold ${f.porcentaje >= 90 ? 'text-[color:var(--ok)]' : f.porcentaje >= 70 ? 'text-[color:var(--warn)]' : 'text-[color:var(--bad)]'}`}>{f.porcentaje}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ───────── INVENTARIO ───────── */}
        {activeTab === 'inventario' && inventario && (
          <div className="space-y-4">
            <StatCards items={[
              { label: 'Productos activos', value: inventario.resumen.productosActivos },
              { label: 'Total unidades', value: inventario.resumen.totalUnidades },
              { label: 'Mermas registradas', value: inventario.resumen.mermasUnidades },
              { label: 'Valor total inventario', value: dinero(inventario.resumen.valorTotal) },
            ]} />

            <Card title="Existencias por Producto">
              {inventario.productos.length === 0 ? <Vacio>Sin productos registrados</Vacio> : (
                <table className="rowtable text-sm">
                  <thead><tr>
                    <th className={`${TH} text-left`}>Producto</th>
                    <th className={`${TH} text-left`}>Categoría</th>
                    <th className={`${TH} text-center`}>Stock</th>
                    <th className={`${TH} text-right`}>Valor</th>
                  </tr></thead>
                  <tbody>
                    {inventario.productos.map(p => (
                      <tr key={p.idProducto} className={p.estatus === 'inactivo' ? 'opacity-50' : ''}>
                        <td className="py-3 font-medium text-[color:var(--ink)]">{p.nombre}</td>
                        <td className="py-3 text-[color:var(--ink2)]">{p.categoria}</td>
                        <td className="py-3 text-center">
                          <span className={p.stock <= 5 ? 'text-[color:var(--bad)] font-semibold' : 'text-[color:var(--ink)] font-medium'}>{p.stock}</span>
                        </td>
                        <td className="py-3 text-right text-[color:var(--ink)]">{dinero(p.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title="Mermas Registradas">
              {inventario.mermas.length === 0 ? <Vacio>Sin mermas registradas</Vacio> : (
                <table className="rowtable text-sm">
                  <thead><tr>
                    <th className={`${TH} text-left`}>Producto</th>
                    <th className={`${TH} text-center`}>Cantidad</th>
                    <th className={`${TH} text-left`}>Motivo</th>
                    <th className={`${TH} text-right`}>Fecha</th>
                  </tr></thead>
                  <tbody>
                    {inventario.mermas.map(m => (
                      <tr key={m.id}>
                        <td className="py-3 font-medium text-[color:var(--ink)]">{m.nombreProducto}</td>
                        <td className="py-3 text-center text-[color:var(--bad)] font-semibold">-{m.cantidad}</td>
                        <td className="py-3 text-[color:var(--ink2)]">{m.motivo}</td>
                        <td className="py-3 text-right text-[color:var(--ink3)]">{m.fecha}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        )}

        {/* ───────── PERSONAL ───────── */}
        {activeTab === 'personal' && personal && (
          personal.resumen.length === 0 ? (
            <Vacio>Sin registros de asistencia del personal en este rango de fechas</Vacio>
          ) : (
            <div className="space-y-4">
              <Card title="Asistencia del Personal">
                <table className="rowtable text-sm">
                  <thead><tr>
                    <th className={`${TH} text-left`}>Empleado</th>
                    <th className={`${TH} text-left`}>Rol</th>
                    <th className={`${TH} text-center !text-[color:var(--ok)]`}>Asistencias</th>
                    <th className={`${TH} text-center !text-[color:var(--warn)]`}>Retardos</th>
                    <th className={`${TH} text-center !text-[color:var(--bad)]`}>Faltas</th>
                    <th className={`${TH} text-right`}>% Asistencia</th>
                  </tr></thead>
                  <tbody>
                    {personal.resumen.map(p => (
                      <tr key={p.idPersona}>
                        <td className="py-3 font-medium text-[color:var(--ink)]">{p.nombre}</td>
                        <td className="py-3 text-[color:var(--ink2)] capitalize">{p.rol ?? '—'}</td>
                        <td className="py-3 text-center text-[color:var(--ok)] font-semibold">{p.asistencias}</td>
                        <td className="py-3 text-center text-[color:var(--warn)] font-semibold">{p.retardos}</td>
                        <td className="py-3 text-center text-[color:var(--bad)] font-semibold">{p.faltas}</td>
                        <td className="py-3 text-right">
                          <span className={`font-semibold ${p.porcentaje >= 90 ? 'text-[color:var(--ok)]' : p.porcentaje >= 70 ? 'text-[color:var(--warn)]' : 'text-[color:var(--bad)]'}`}>{p.porcentaje}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <Card title="Registro de Asistencia Detallado">
                <table className="rowtable text-sm">
                  <thead><tr>
                    <th className={`${TH} text-left`}>Empleado</th>
                    <th className={`${TH} text-left`}>Fecha</th>
                    <th className={`${TH} text-left`}>Entrada</th>
                    <th className={`${TH} text-left`}>Salida</th>
                    <th className={`${TH} text-center`}>Tipo</th>
                  </tr></thead>
                  <tbody>
                    {personal.detalle.map(a => (
                      <tr key={a.id}>
                        <td className="py-3 font-medium text-[color:var(--ink)]">{a.nombrePersona}</td>
                        <td className="py-3 text-[color:var(--ink2)]">{a.fecha}</td>
                        <td className="py-3 text-[color:var(--ink2)]">{a.horaEntrada || '—'}</td>
                        <td className="py-3 text-[color:var(--ink2)]">{a.horaSalida || '—'}</td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.tipoRegistro === 'asistencia' ? 'bg-[color:var(--ok-bg)] text-[color:var(--ok-ink)]' : a.tipoRegistro === 'retardo' ? 'bg-[color:var(--warn-bg)] text-[color:var(--warn-ink)]' : 'bg-[color:var(--bad-bg)] text-[color:var(--bad)]'}`}>
                            {a.tipoRegistro}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )
        )}
      </DataState>
    </div>
  );
}