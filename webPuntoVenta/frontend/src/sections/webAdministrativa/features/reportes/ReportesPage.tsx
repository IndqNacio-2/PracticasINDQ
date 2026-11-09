import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

import { api } from '../../lib/api';

type Tab = 'ventas' | 'visitas' | 'asistencia' | 'inventario' | 'personal';

const tabs: { value: Tab; label: string; icon: string }[] = [
  { value: 'ventas', label: 'Ventas', icon: '💰' },
  { value: 'visitas', label: 'Visitas', icon: '📈' },
  { value: 'asistencia', label: 'Asistencia a Clases', icon: '🏋️' },
  { value: 'inventario', label: 'Inventario', icon: '📦' },
  { value: 'personal', label: 'Personal', icon: '👥' },
];

const PIE_COLORS = ['#4B5563', '#6B7280', '#9CA3AF', '#374151', '#D1D5DB'];
const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 };
const TH = 'pb-3 text-xs font-semibold text-gray-400 uppercase';
const CARD = 'bg-white rounded-2xl p-5 border border-gray-100 shadow-sm';
const TITLE_FONT = { fontFamily: 'DM Sans, sans-serif' };

// ---------------------------------------------------------------------
// Tipos de las respuestas de /reportes/*
// ---------------------------------------------------------------------

interface ReporteVentas {
  resumen: { totalVentas: number; transacciones: number; ticketPromedio: number; unidadesVendidas: number; productoTop: string | null };
  porDia: { fecha: string; ventas: number; transacciones: number }[];
  porHora: { hora: number; ventas: number; transacciones: number }[];
  porCategoria: { categoria: string; total: number; unidades: number }[];
  productos: { categoria: string; nombre: string; precio: number; unidades: number; importe: number }[];
  tickets: { folio: string; fecha: string; hora: string; total: number; formaPago: string; articulos: number }[];
  ticketsTruncados: boolean;
}

interface ReporteVisitas {
  resumen: {
    totalVisitas: number; visitantesUnicos: number; promedioDiario: number;
    diaPico: { fecha: string; visitas: number } | null;
    horaPico: { hora: number; visitas: number } | null;
  };
  porDia: { fecha: string; visitas: number; unicos: number }[];
  porHora: { hora: number; visitas: number }[];
}

interface Acumulado {
  reservadas: number; asistieron: number; noAsistieron: number; canceladas: number; tasaAsistencia: number | null;
}
interface ReporteAsistencia {
  entrenadoresDisponibles: boolean;
  resumen: Acumulado;
  porClase: (Acumulado & { clase: string })[];
  porEntrenador: (Acumulado & { entrenador: string })[];
  detalle: (Acumulado & { clase: string; entrenador: string })[];
}

interface ReporteInventario {
  resumen: {
    productosActivos: number; totalUnidades: number; valorAlCosto: number; valorAlPrecio: number;
    conPocoStock: number; agotados: number; mermasUnidades: number; mermasPerdida: number;
  };
  productos: { id: number; codigo: string; nombre: string; categoria: string; precio: number; costo: number; stock: number; stockMinimo: number; estatus: string }[];
  mermas: { id: number; folio: string; producto: string; cantidad: number; motivo: string; observaciones: string; perdida: number; fecha: string; registradoPor: string }[];
  mermasPorMotivo: { motivo: string; registros: number; unidades: number; perdida: number }[];
}

interface ReportePersonal {
  clasificacionDisponible: boolean;
  resumen: { empleados: number; puntuales: number; retardos: number; faltas: number; asistenciaPct: number | null; retardoPct: number | null; ausentismoPct: number | null };
  porEmpleado: {
    codigo: string; nombre: string; rol: string; entradas: number; puntuales: number; retardos: number; faltas: number;
    sinTurno: number; sinClasificar: number; diasEvaluados: number; asistenciaPct: number | null; retardoPct: number | null; ausentismoPct: number | null;
  }[];
  registros: { codigo: string; nombre: string; fecha: string; entrada: string | null; salida: string | null; estado: string | null; automatica: boolean }[];
  registrosTruncados: boolean;
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

function fechaISO(fecha = new Date()): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function etiquetaDia(fecha: string): string {
  const [, mes, dia] = fecha.split('-').map(Number);
  return `${dia}/${mes}`;
}

const etiquetaHora = (hora: number) => `${String(hora).padStart(2, '0')}:00`;
const dinero = (valor: number | null | undefined) => `$${Number(valor ?? 0).toLocaleString('es-MX')}`;
const pct = (valor: number | null | undefined) => (valor === null || valor === undefined ? '—' : `${valor}%`);

function exportarCsv(nombre: string, filas: (string | number)[][]) {
  const csv = filas
    .map(fila => fila.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

function SinDatos({ texto }: { texto: string }) {
  return <p className="text-gray-400 text-center py-8 text-sm">{texto}</p>;
}

function Resumen({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map(s => (
        <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">{s.label}</p>
          <p className="text-xl font-bold text-gray-900" style={TITLE_FONT}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="note">
      {texto}
    </div>
  );
}

const ESTADO_PERSONAL: Record<string, { texto: string; clase: string }> = {
  puntual: { texto: 'Puntual', clase: 'bg-[#F3F4F6] text-[#6B7280]' },
  retardo: { texto: 'Retardo', clase: 'bg-amber-50 text-amber-700' },
  inasistencia: { texto: 'Falta', clase: 'bg-red-50 text-red-600' },
  sin_turno: { texto: 'Sin turno', clase: 'bg-gray-100 text-gray-500' },
};

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------

export function ReportesPage() {
  const hoy = fechaISO();

  const [activeTab, setActiveTab] = useState<Tab>('ventas');
  const [dateFrom, setDateFrom] = useState(`${hoy.slice(0, 7)}-01`);
  const [dateTo, setDateTo] = useState(hoy);
  const [horaDesde, setHoraDesde] = useState(0);
  const [horaHasta, setHoraHasta] = useState(23);

  const [ventas, setVentas] = useState<ReporteVentas | null>(null);
  const [visitas, setVisitas] = useState<ReporteVisitas | null>(null);
  const [asistencia, setAsistencia] = useState<ReporteAsistencia | null>(null);
  const [inventario, setInventario] = useState<ReporteInventario | null>(null);
  const [personal, setPersonal] = useState<ReportePersonal | null>(null);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Solo se consulta el reporte de la pestaña visible.
  const cargar = useCallback(async () => {
    if (dateFrom > dateTo) {
      setError('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    if (horaDesde > horaHasta) {
      setError('La hora inicial no puede ser posterior a la final.');
      return;
    }

    setCargando(true);
    setError(null);

    const query = `?desde=${dateFrom}&hasta=${dateTo}&horaDesde=${horaDesde}&horaHasta=${horaHasta}`;

    try {
      switch (activeTab) {
        case 'ventas': setVentas(await api.get<ReporteVentas>(`/reportes/ventas${query}`)); break;
        case 'visitas': setVisitas(await api.get<ReporteVisitas>(`/reportes/visitas${query}`)); break;
        case 'asistencia': setAsistencia(await api.get<ReporteAsistencia>(`/reportes/asistencia-clases${query}`)); break;
        case 'inventario': setInventario(await api.get<ReporteInventario>(`/reportes/inventario${query}`)); break;
        case 'personal': setPersonal(await api.get<ReportePersonal>(`/reportes/personal${query}`)); break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte.');
    } finally {
      setCargando(false);
    }
  }, [activeTab, dateFrom, dateTo, horaDesde, horaHasta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const textoVacio = (vacio: string) => (cargando ? 'Cargando...' : vacio);
  const horas = Array.from({ length: 24 }, (_, h) => h);

  return (
    <div className="space-y-5 max-w-7xl" aria-busy={cargando}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={TITLE_FONT}>Reportes</h1>
          <p className="text-gray-500 text-sm mt-0.5">Análisis y estadísticas del sistema</p>
        </div>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#111827]" />
          <span className="text-gray-400">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#111827]" />
          <select value={horaDesde} onChange={e => setHoraDesde(Number(e.target.value))} aria-label="Hora inicial" className="px-3 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#111827]">
            {horas.map(h => <option key={h} value={h}>{etiquetaHora(h)}</option>)}
          </select>
          <span className="text-gray-400">a</span>
          <select value={horaHasta} onChange={e => setHoraHasta(Number(e.target.value))} aria-label="Hora final" className="px-3 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#111827]">
            {horas.map(h => <option key={h} value={h}>{etiquetaHora(h)}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="rx-admin-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void cargar()} className="rx-btn rx-btn--outline rx-btn--sm">
            Reintentar
          </button>
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
          <Resumen items={[
            { label: 'Total ventas', value: ventas ? dinero(ventas.resumen.totalVentas) : '—' },
            { label: 'Transacciones', value: ventas?.resumen.transacciones ?? '—' },
            { label: 'Ticket promedio', value: ventas ? dinero(ventas.resumen.ticketPromedio) : '—' },
            { label: 'Producto top', value: ventas?.resumen.productoTop ?? '—' },
          ]} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={CARD}>
              <h3 className="font-semibold text-gray-900 mb-4" style={TITLE_FONT}>Ventas por día</h3>
              {!ventas || ventas.resumen.transacciones === 0 ? (
                <SinDatos texto={textoVacio('Sin ventas en este rango')} />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ventas.porDia.map(d => ({ ...d, dia: etiquetaDia(d.fecha) }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip formatter={(v) => [dinero(Number(v)), 'Ventas']} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="ventas" fill="#4B5563" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className={CARD}>
              <h3 className="font-semibold text-gray-900 mb-4" style={TITLE_FONT}>Ventas por horario</h3>
              {!ventas || ventas.resumen.transacciones === 0 ? (
                <SinDatos texto={textoVacio('Sin ventas en este rango')} />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ventas.porHora.map(h => ({ ...h, etiqueta: etiquetaHora(h.hora) }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip formatter={(v) => [dinero(Number(v)), 'Ventas']} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="ventas" fill="#6B7280" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={CARD}>
              <h3 className="font-semibold text-gray-900 mb-4" style={TITLE_FONT}>Ventas por tipo de producto</h3>
              {!ventas || ventas.porCategoria.length === 0 ? (
                <SinDatos texto={textoVacio('Sin ventas en este rango')} />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={ventas.porCategoria} dataKey="total" nameKey="categoria" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                      {ventas.porCategoria.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [dinero(Number(v)), 'Total']} contentStyle={TOOLTIP_STYLE} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className={CARD}>
              <h3 className="font-semibold text-gray-900 mb-4" style={TITLE_FONT}>Productos vendidos</h3>
              {!ventas || ventas.productos.length === 0 ? (
                <SinDatos texto={textoVacio('Sin ventas en este rango')} />
              ) : (
                <div className="max-h-[250px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100">
                      <th className={`${TH} text-left`}>Producto</th>
                      <th className={`${TH} text-right`}>Precio</th>
                      <th className={`${TH} text-center`}>Unidades</th>
                      <th className={`${TH} text-right`}>Importe</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {ventas.productos.map(p => (
                        <tr key={`${p.categoria}-${p.nombre}`}>
                          <td className="py-2 font-medium text-gray-800">{p.nombre}<span className="block text-xs text-gray-400">{p.categoria}</span></td>
                          <td className="py-2 text-right text-gray-600">{dinero(p.precio)}</td>
                          <td className="py-2 text-center text-gray-600">{p.unidades}</td>
                          <td className="py-2 text-right font-semibold text-gray-800">{dinero(p.importe)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className={CARD}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900" style={TITLE_FONT}>Detalle de ventas</h3>
              <button
                className="rx-btn rx-btn--outline rx-btn--sm"
                disabled={!ventas || ventas.tickets.length === 0}
                onClick={() => ventas && exportarCsv('reporte-ventas.csv', [
                  ['Folio', 'Fecha', 'Hora', 'Forma de pago', 'Artículos', 'Total'],
                  ...ventas.tickets.map(t => [t.folio, t.fecha, t.hora, t.formaPago, t.articulos, t.total]),
                ])}
              >
                Exportar CSV
              </button>
            </div>
            {!ventas || ventas.tickets.length === 0 ? (
              <SinDatos texto={textoVacio('Sin ventas en este rango')} />
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100">
                    <th className={`${TH} text-left`}>Folio</th>
                    <th className={`${TH} text-left`}>Fecha</th>
                    <th className={`${TH} text-left`}>Hora</th>
                    <th className={`${TH} text-left`}>Pago</th>
                    <th className={`${TH} text-center`}>Artículos</th>
                    <th className={`${TH} text-right`}>Total</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {ventas.tickets.map(t => (
                      <tr key={t.folio}>
                        <td className="py-3 font-medium text-gray-800">{t.folio}</td>
                        <td className="py-3 text-gray-500">{t.fecha}</td>
                        <td className="py-3 text-gray-500">{t.hora}</td>
                        <td className="py-3 text-gray-500 capitalize">{t.formaPago}</td>
                        <td className="py-3 text-center text-gray-600">{t.articulos}</td>
                        <td className="py-3 text-right font-semibold text-gray-800">{dinero(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ventas.ticketsTruncados && (
                  <p className="text-xs text-gray-400 mt-3">Se muestran las 500 ventas más recientes del rango.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* VISITAS */}
      {activeTab === 'visitas' && (
        <div className="space-y-4">
          <Resumen items={[
            { label: 'Total visitas', value: visitas?.resumen.totalVisitas ?? '—' },
            { label: 'Visitantes únicos', value: visitas?.resumen.visitantesUnicos ?? '—' },
            { label: 'Promedio diario', value: visitas?.resumen.promedioDiario ?? '—' },
            { label: 'Hora pico', value: visitas?.resumen.horaPico ? etiquetaHora(visitas.resumen.horaPico.hora) : '—' },
          ]} />

          <div className={CARD}>
            <h3 className="font-semibold text-gray-900 mb-1" style={TITLE_FONT}>Visitas por día</h3>
            <p className="text-xs text-gray-400 mb-4">Entradas de socios registradas en el reloj checador.</p>
            {!visitas || visitas.resumen.totalVisitas === 0 ? (
              <SinDatos texto={textoVacio('Sin visitas en este rango')} />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={visitas.porDia.map(d => ({ ...d, dia: etiquetaDia(d.fecha) }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="visitas" name="Visitas" stroke="#6B7280" strokeWidth={2.5} dot={{ r: 3, fill: '#6B7280' }} />
                  <Line type="monotone" dataKey="unicos" name="Únicos" stroke="#9CA3AF" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className={CARD}>
            <h3 className="font-semibold text-gray-900 mb-4" style={TITLE_FONT}>Visitas por horario</h3>
            {!visitas || visitas.resumen.totalVisitas === 0 ? (
              <SinDatos texto={textoVacio('Sin visitas en este rango')} />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={visitas.porHora.map(h => ({ ...h, etiqueta: etiquetaHora(h.hora) }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="visitas" fill="#4B5563" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ASISTENCIA A CLASES */}
      {activeTab === 'asistencia' && (
        <div className="space-y-4">
          <Resumen items={[
            { label: 'Reservaciones', value: asistencia?.resumen.reservadas ?? '—' },
            { label: 'Asistieron', value: asistencia?.resumen.asistieron ?? '—' },
            { label: 'No asistieron', value: asistencia?.resumen.noAsistieron ?? '—' },
            { label: 'Tasa de asistencia', value: pct(asistencia?.resumen.tasaAsistencia) },
          ]} />

          {asistencia && !asistencia.entrenadoresDisponibles && (
            <Aviso texto="No se pudo consultar a los entrenadores en MongoDB; las clases aparecen como «Sin asignar»." />
          )}

          <div className={CARD}>
            <h3 className="font-semibold text-gray-900 mb-4" style={TITLE_FONT}>Asistencia por clase</h3>
            {!asistencia || asistencia.porClase.length === 0 ? (
              <SinDatos texto={textoVacio('Sin reservaciones en este rango')} />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, asistencia.porClase.length * 44)}>
                <BarChart data={asistencia.porClase} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="clase" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="asistieron" name="Asistieron" fill="#4B5563" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="noAsistieron" name="No asistieron" fill="#D1D5DB" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className={CARD}>
            <h3 className="font-semibold text-gray-900 mb-4" style={TITLE_FONT}>Asistencia por entrenador</h3>
            {!asistencia || asistencia.porEntrenador.length === 0 ? (
              <SinDatos texto={textoVacio('Sin reservaciones en este rango')} />
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  <th className={`${TH} text-left`}>Entrenador</th>
                  <th className={`${TH} text-center`}>Reservadas</th>
                  <th className={`${TH} text-center`}>Asistieron</th>
                  <th className={`${TH} text-center`}>No asistieron</th>
                  <th className={`${TH} text-center`}>Canceladas</th>
                  <th className={`${TH} text-right`}>Tasa</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {asistencia.porEntrenador.map(e => (
                    <tr key={e.entrenador}>
                      <td className="py-3 font-medium text-gray-800">{e.entrenador}</td>
                      <td className="py-3 text-center text-gray-600">{e.reservadas}</td>
                      <td className="py-3 text-center text-gray-800 font-semibold">{e.asistieron}</td>
                      <td className="py-3 text-center text-gray-600">{e.noAsistieron}</td>
                      <td className="py-3 text-center text-gray-400">{e.canceladas}</td>
                      <td className="py-3 text-right font-semibold text-gray-800">{pct(e.tasaAsistencia)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={CARD}>
            <h3 className="font-semibold text-gray-900 mb-4" style={TITLE_FONT}>Detalle por clase y entrenador</h3>
            {!asistencia || asistencia.detalle.length === 0 ? (
              <SinDatos texto={textoVacio('Sin reservaciones en este rango')} />
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  <th className={`${TH} text-left`}>Clase</th>
                  <th className={`${TH} text-left`}>Entrenador</th>
                  <th className={`${TH} text-center`}>Reservadas</th>
                  <th className={`${TH} text-center`}>Asistieron</th>
                  <th className={`${TH} text-right`}>Tasa</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {asistencia.detalle.map(d => (
                    <tr key={`${d.clase}-${d.entrenador}`}>
                      <td className="py-3 font-medium text-gray-800">{d.clase}</td>
                      <td className="py-3 text-gray-500">{d.entrenador}</td>
                      <td className="py-3 text-center text-gray-600">{d.reservadas}</td>
                      <td className="py-3 text-center text-gray-800 font-semibold">{d.asistieron}</td>
                      <td className="py-3 text-right text-gray-800 font-semibold">{pct(d.tasaAsistencia)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* INVENTARIO */}
      {activeTab === 'inventario' && (
        <div className="space-y-4">
          <Resumen items={[
            { label: 'Productos activos', value: inventario?.resumen.productosActivos ?? '—' },
            { label: 'Total unidades', value: inventario?.resumen.totalUnidades ?? '—' },
            { label: 'Valor al costo', value: inventario ? dinero(inventario.resumen.valorAlCosto) : '—' },
            { label: 'Valor al precio', value: inventario ? dinero(inventario.resumen.valorAlPrecio) : '—' },
            { label: 'Con poco stock', value: inventario?.resumen.conPocoStock ?? '—' },
            { label: 'Agotados', value: inventario?.resumen.agotados ?? '—' },
            { label: 'Unidades en merma', value: inventario?.resumen.mermasUnidades ?? '—' },
            { label: 'Pérdida por mermas', value: inventario ? dinero(inventario.resumen.mermasPerdida) : '—' },
          ]} />

          <div className={CARD}>
            <h3 className="font-semibold text-gray-900 mb-1" style={TITLE_FONT}>Existencias por producto</h3>
            <p className="text-xs text-gray-400 mb-4">Las existencias son las de hoy; el rango de fechas solo afecta a las mermas.</p>
            {!inventario || inventario.productos.length === 0 ? (
              <SinDatos texto={textoVacio('Sin productos registrados')} />
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  <th className={`${TH} text-left`}>Producto</th>
                  <th className={`${TH} text-left`}>Categoría</th>
                  <th className={`${TH} text-center`}>Stock</th>
                  <th className={`${TH} text-center`}>Mínimo</th>
                  <th className={`${TH} text-right`}>Valor al precio</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {inventario.productos.map(p => (
                    <tr key={p.id}>
                      <td className="py-3 font-medium text-gray-800">{p.nombre}<span className="block text-xs text-gray-400">{p.codigo}</span></td>
                      <td className="py-3 text-gray-500">{p.categoria}</td>
                      <td className="py-3 text-center">
                        <span className={p.stock <= p.stockMinimo ? 'text-red-500 font-semibold' : 'text-gray-700 font-medium'}>{p.stock}</span>
                      </td>
                      <td className="py-3 text-center text-gray-400">{p.stockMinimo}</td>
                      <td className="py-3 text-right text-gray-700">{dinero(p.stock * p.precio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={CARD}>
            <h3 className="font-semibold text-gray-900 mb-4" style={TITLE_FONT}>Mermas del periodo</h3>
            {!inventario || inventario.mermas.length === 0 ? (
              <SinDatos texto={textoVacio('Sin mermas registradas en este rango')} />
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {inventario.mermasPorMotivo.map(m => (
                    <span key={m.motivo} className="px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-600">
                      {m.motivo}: {m.unidades} u · {dinero(m.perdida)}
                    </span>
                  ))}
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100">
                    <th className={`${TH} text-left`}>Folio</th>
                    <th className={`${TH} text-left`}>Producto</th>
                    <th className={`${TH} text-center`}>Cantidad</th>
                    <th className={`${TH} text-left`}>Motivo</th>
                    <th className={`${TH} text-right`}>Pérdida</th>
                    <th className={`${TH} text-right`}>Fecha</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {inventario.mermas.map(m => (
                      <tr key={m.id}>
                        <td className="py-3 text-gray-500">{m.folio}</td>
                        <td className="py-3 font-medium text-gray-800">{m.producto}</td>
                        <td className="py-3 text-center text-red-500 font-semibold">-{m.cantidad}</td>
                        <td className="py-3 text-gray-500">{m.motivo}</td>
                        <td className="py-3 text-right text-gray-700">{dinero(m.perdida)}</td>
                        <td className="py-3 text-right text-gray-400">{m.fecha}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}

      {/* PERSONAL */}
      {activeTab === 'personal' && (
        <div className="space-y-4">
          <Resumen items={[
            { label: 'Empleados', value: personal?.resumen.empleados ?? '—' },
            { label: '% asistencia', value: pct(personal?.resumen.asistenciaPct) },
            { label: '% retardos', value: pct(personal?.resumen.retardoPct) },
            { label: '% ausentismo', value: pct(personal?.resumen.ausentismoPct) },
          ]} />

          {personal && !personal.clasificacionDisponible && (
            <Aviso texto="Todavía no se aplicó la migración db/asistencia-turnos.sql: se cuentan las entradas, pero no se puede clasificar puntualidad, retardos ni faltas." />
          )}

          <div className={CARD}>
            <h3 className="font-semibold text-gray-900 mb-4" style={TITLE_FONT}>Asistencia del personal</h3>
            {!personal || personal.porEmpleado.length === 0 ? (
              <SinDatos texto={textoVacio('Sin empleados registrados')} />
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  <th className={`${TH} text-left`}>Empleado</th>
                  <th className={`${TH} text-left`}>Rol</th>
                  <th className={`${TH} text-center`}>Puntuales</th>
                  <th className={`${TH} text-center`}>Retardos</th>
                  <th className={`${TH} text-center`}>Faltas</th>
                  <th className={`${TH} text-right`}>% Asistencia</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {personal.porEmpleado.map(p => (
                    <tr key={p.codigo}>
                      <td className="py-3 font-medium text-gray-800">{p.nombre}<span className="block text-xs text-gray-400">{p.codigo}</span></td>
                      <td className="py-3 text-gray-500 capitalize">{p.rol}</td>
                      <td className="py-3 text-center text-emerald-600 font-semibold">{p.puntuales}</td>
                      <td className="py-3 text-center text-amber-500 font-semibold">{p.retardos}</td>
                      <td className="py-3 text-center text-red-500 font-semibold">{p.faltas}</td>
                      <td className="py-3 text-right">
                        <span className={`font-semibold ${p.asistenciaPct === null ? 'text-gray-400' : p.asistenciaPct >= 90 ? 'text-emerald-600' : p.asistenciaPct >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                          {pct(p.asistenciaPct)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={CARD}>
            <h3 className="font-semibold text-gray-900 mb-4" style={TITLE_FONT}>Registro de asistencia detallado</h3>
            {!personal || personal.registros.length === 0 ? (
              <SinDatos texto={textoVacio('Sin registros en este rango')} />
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100">
                    <th className={`${TH} text-left`}>Empleado</th>
                    <th className={`${TH} text-left`}>Fecha</th>
                    <th className={`${TH} text-left`}>Entrada</th>
                    <th className={`${TH} text-left`}>Salida</th>
                    <th className={`${TH} text-center`}>Estado</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {personal.registros.map(r => {
                      const estado = r.estado ? ESTADO_PERSONAL[r.estado] : undefined;
                      return (
                        <tr key={`${r.codigo}-${r.fecha}`}>
                          <td className="py-3 font-medium text-gray-800">{r.nombre}</td>
                          <td className="py-3 text-gray-500">{r.fecha}</td>
                          <td className="py-3 text-gray-600">{r.entrada ?? '—'}</td>
                          <td className="py-3 text-gray-600">{r.salida ?? '—'}</td>
                          <td className="py-3 text-center">
                            {estado ? (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estado.clase}`}>{estado.texto}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {personal.registrosTruncados && (
                  <p className="text-xs text-gray-400 mt-3">Se muestran los 500 registros más recientes del rango.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}