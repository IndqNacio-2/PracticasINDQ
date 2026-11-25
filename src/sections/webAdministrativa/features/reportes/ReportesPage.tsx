import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

import { Icon } from '../../components/Icon';
import { api } from '../../lib/api';

type Tab = 'ventas' | 'visitas' | 'asistencia' | 'inventario' | 'personal';

const tabs: { value: Tab; label: string; icon: string }[] = [
  { value: 'ventas', label: 'Ventas', icon: 'payments' },
  { value: 'visitas', label: 'Visitas', icon: 'monitoring' },
  { value: 'asistencia', label: 'Asistencia a Clases', icon: 'fitness_center' },
  { value: 'inventario', label: 'Inventario', icon: 'inventory_2' },
  { value: 'personal', label: 'Personal', icon: 'groups' },
];

const PIE_COLORS = [
  'var(--rx-dark)',
  'var(--rx-accent)',
  'var(--rx-success)',
  'var(--rx-warning)',
  'var(--rx-ink-muted)',
];
const TOOLTIP_STYLE = {
  backgroundColor: 'var(--rx-surface)',
  borderRadius: 12,
  border: '1px solid var(--rx-line)',
  color: 'var(--rx-ink)',
  fontSize: 12,
};
const CHART_GRID = 'var(--rx-line)';
const CHART_TICK = 'var(--rx-ink-muted)';
const CHART_PRIMARY = 'var(--rx-dark)';
const CHART_SECONDARY = 'var(--rx-success)';
const TH = 'rx-reports-table-heading';
const CARD = 'rx-card rx-reports-card';
const KPI_ICONS = ['monitoring', 'receipt_long', 'payments', 'workspace_premium'];

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
  return <div className="rx-admin-empty" role="status"><p>{texto}</p></div>;
}

function Resumen({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="rx-grid-kpi rx-admin-kpi-grid rx-reports-kpis" aria-live="polite">
      {items.map((s, index) => (
        <article key={s.label} className="rx-kpi-card rx-admin-stat rx-reports-stat">
          <div>
            <p className="rx-kpi-label">{s.label}</p>
            <p className="rx-kpi-value">{s.value}</p>
          </div>
          <span className={`rx-reports-stat-icon rx-reports-stat-icon--${(index % 4) + 1}`}>
            <Icon name={KPI_ICONS[index % KPI_ICONS.length]} size={22} />
          </span>
        </article>
      ))}
    </div>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="rx-alert rx-alert--warning" role="note">
      <Icon name="warning" size={20} />
      {texto}
    </div>
  );
}

const ESTADO_PERSONAL: Record<string, { texto: string; clase: string }> = {
  puntual: { texto: 'Puntual', clase: 'rx-badge rx-badge--success' },
  retardo: { texto: 'Retardo', clase: 'rx-badge rx-badge--warning' },
  inasistencia: { texto: 'Falta', clase: 'rx-badge rx-badge--danger' },
  sin_turno: { texto: 'Sin turno', clase: 'rx-badge rx-badge--neutral' },
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
    <div className="rx-admin-module rx-admin-reports" aria-busy={cargando}>
      <header className="rx-page-header rx-module-header">
        <div>
          <h1 className="rx-page-title">Reportes</h1>
          <p className="rx-page-subtitle">Análisis y estadísticas del sistema</p>
        </div>
        <div className="rx-module-header-actions rx-reports-period" aria-label="Periodo del reporte">
          <label className="rx-reports-control">
            <span>Desde</span>
            <input type="date" aria-label="Fecha inicial" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rx-input" />
          </label>
          <label className="rx-reports-control">
            <span>Hasta</span>
            <input type="date" aria-label="Fecha final" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rx-input" />
          </label>
          <label className="rx-reports-control rx-reports-control--time">
            <span>Hora inicial</span>
            <select value={horaDesde} onChange={e => setHoraDesde(Number(e.target.value))} aria-label="Hora inicial" className="rx-select">
            {horas.map(h => <option key={h} value={h}>{etiquetaHora(h)}</option>)}
            </select>
          </label>
          <label className="rx-reports-control rx-reports-control--time">
            <span>Hora final</span>
            <select value={horaHasta} onChange={e => setHoraHasta(Number(e.target.value))} aria-label="Hora final" className="rx-select">
            {horas.map(h => <option key={h} value={h}>{etiquetaHora(h)}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className="rx-admin-module-content rx-reports-content space-y-5">
      {error && (
        <div className="rx-admin-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void cargar()} className="rx-btn rx-btn--outline rx-btn--sm">
            Reintentar
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="rx-filter-bar rx-reports-tabs-bar">
        <div className="rx-tabs rx-reports-tabs" role="tablist" aria-label="Tipo de reporte">
        {tabs.map(tab => (
          <button key={tab.value} type="button" role="tab" aria-selected={activeTab === tab.value} onClick={() => setActiveTab(tab.value)}
            className="rx-tab">
            <Icon name={tab.icon} size={18} weight={500} />
            {tab.label}
          </button>
        ))}
        </div>
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
              <h3 className="rx-card-title">Ventas por día</h3>
              {!ventas || ventas.resumen.transacciones === 0 ? (
                <SinDatos texto={textoVacio('Sin ventas en este rango')} />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ventas.porDia.map(d => ({ ...d, dia: etiquetaDia(d.fecha) }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11, fill: CHART_TICK }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: CHART_TICK }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip formatter={(v) => [dinero(Number(v)), 'Ventas']} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="ventas" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className={CARD}>
              <h3 className="rx-card-title">Ventas por horario</h3>
              {!ventas || ventas.resumen.transacciones === 0 ? (
                <SinDatos texto={textoVacio('Sin ventas en este rango')} />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ventas.porHora.map(h => ({ ...h, etiqueta: etiquetaHora(h.hora) }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: CHART_TICK }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: CHART_TICK }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip formatter={(v) => [dinero(Number(v)), 'Ventas']} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="ventas" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={CARD}>
              <h3 className="rx-card-title">Ventas por tipo de producto</h3>
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
              <h3 className="rx-card-title">Productos vendidos</h3>
              {!ventas || ventas.productos.length === 0 ? (
                <SinDatos texto={textoVacio('Sin ventas en este rango')} />
              ) : (
                <div className="max-h-[250px] overflow-auto">
                  <table className="rx-table rx-reports-table">
                    <thead><tr className="border-b border-[var(--rx-line)]">
                      <th className={`${TH} text-left`}>Producto</th>
                      <th className={`${TH} text-right`}>Precio</th>
                      <th className={`${TH} text-center`}>Unidades</th>
                      <th className={`${TH} text-right`}>Importe</th>
                    </tr></thead>
                    <tbody >
                      {ventas.productos.map(p => (
                        <tr key={`${p.categoria}-${p.nombre}`}>
                          <td className="py-2 font-medium text-[color:var(--rx-ink)]">{p.nombre}<span className="block text-xs text-[color:var(--rx-ink-muted)]">{p.categoria}</span></td>
                          <td className="py-2 text-right text-[color:var(--rx-ink-secondary)]">{dinero(p.precio)}</td>
                          <td className="py-2 text-center text-[color:var(--rx-ink-secondary)]">{p.unidades}</td>
                          <td className="py-2 text-right font-semibold text-[color:var(--rx-ink)]">{dinero(p.importe)}</td>
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
              <h3 className="rx-card-title">Detalle de ventas</h3>
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
                <table className="rx-table rx-reports-table">
                  <thead><tr className="border-b border-[var(--rx-line)]">
                    <th className={`${TH} text-left`}>Folio</th>
                    <th className={`${TH} text-left`}>Fecha</th>
                    <th className={`${TH} text-left`}>Hora</th>
                    <th className={`${TH} text-left`}>Pago</th>
                    <th className={`${TH} text-center`}>Artículos</th>
                    <th className={`${TH} text-right`}>Total</th>
                  </tr></thead>
                  <tbody >
                    {ventas.tickets.map(t => (
                      <tr key={t.folio}>
                        <td className="py-3 font-medium text-[color:var(--rx-ink)]">{t.folio}</td>
                        <td className="py-3 text-[color:var(--rx-ink-secondary)]">{t.fecha}</td>
                        <td className="py-3 text-[color:var(--rx-ink-secondary)]">{t.hora}</td>
                        <td className="py-3 text-[color:var(--rx-ink-secondary)] capitalize">{t.formaPago}</td>
                        <td className="py-3 text-center text-[color:var(--rx-ink-secondary)]">{t.articulos}</td>
                        <td className="py-3 text-right font-semibold text-[color:var(--rx-ink)]">{dinero(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ventas.ticketsTruncados && (
                  <p className="text-xs text-[color:var(--rx-ink-muted)] mt-3">Se muestran las 500 ventas más recientes del rango.</p>
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
            <h3 className="rx-card-title">Visitas por día</h3>
            <p className="text-xs text-[color:var(--rx-ink-muted)] mb-4">Entradas de socios registradas en el reloj checador.</p>
            {!visitas || visitas.resumen.totalVisitas === 0 ? (
              <SinDatos texto={textoVacio('Sin visitas en este rango')} />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={visitas.porDia.map(d => ({ ...d, dia: etiquetaDia(d.fecha) }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: CHART_TICK }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART_TICK }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="visitas" name="Visitas" stroke={CHART_PRIMARY} strokeWidth={2.5} dot={{ r: 3, fill: CHART_PRIMARY }} />
                  <Line type="monotone" dataKey="unicos" name="Únicos" stroke={CHART_SECONDARY} strokeWidth={2} strokeDasharray="4 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className={CARD}>
            <h3 className="rx-card-title">Visitas por horario</h3>
            {!visitas || visitas.resumen.totalVisitas === 0 ? (
              <SinDatos texto={textoVacio('Sin visitas en este rango')} />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={visitas.porHora.map(h => ({ ...h, etiqueta: etiquetaHora(h.hora) }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: CHART_TICK }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART_TICK }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="visitas" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} />
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
            <h3 className="rx-card-title">Asistencia por clase</h3>
            {!asistencia || asistencia.porClase.length === 0 ? (
              <SinDatos texto={textoVacio('Sin reservaciones en este rango')} />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, asistencia.porClase.length * 44)}>
                <BarChart data={asistencia.porClase} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: CHART_TICK }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="clase" tick={{ fontSize: 11, fill: CHART_TICK }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="asistieron" name="Asistieron" fill={CHART_PRIMARY} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="noAsistieron" name="No asistieron" fill={CHART_SECONDARY} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className={CARD}>
            <h3 className="rx-card-title">Asistencia por entrenador</h3>
            {!asistencia || asistencia.porEntrenador.length === 0 ? (
              <SinDatos texto={textoVacio('Sin reservaciones en este rango')} />
            ) : (
              <table className="rx-table rx-reports-table">
                <thead><tr className="border-b border-[var(--rx-line)]">
                  <th className={`${TH} text-left`}>Entrenador</th>
                  <th className={`${TH} text-center`}>Reservadas</th>
                  <th className={`${TH} text-center`}>Asistieron</th>
                  <th className={`${TH} text-center`}>No asistieron</th>
                  <th className={`${TH} text-center`}>Canceladas</th>
                  <th className={`${TH} text-right`}>Tasa</th>
                </tr></thead>
                <tbody >
                  {asistencia.porEntrenador.map(e => (
                    <tr key={e.entrenador}>
                      <td className="py-3 font-medium text-[color:var(--rx-ink)]">{e.entrenador}</td>
                      <td className="py-3 text-center text-[color:var(--rx-ink-secondary)]">{e.reservadas}</td>
                      <td className="py-3 text-center text-[color:var(--rx-ink)] font-semibold">{e.asistieron}</td>
                      <td className="py-3 text-center text-[color:var(--rx-ink-secondary)]">{e.noAsistieron}</td>
                      <td className="py-3 text-center text-[color:var(--rx-ink-muted)]">{e.canceladas}</td>
                      <td className="py-3 text-right font-semibold text-[color:var(--rx-ink)]">{pct(e.tasaAsistencia)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={CARD}>
            <h3 className="rx-card-title">Detalle por clase y entrenador</h3>
            {!asistencia || asistencia.detalle.length === 0 ? (
              <SinDatos texto={textoVacio('Sin reservaciones en este rango')} />
            ) : (
              <table className="rx-table rx-reports-table">
                <thead><tr className="border-b border-[var(--rx-line)]">
                  <th className={`${TH} text-left`}>Clase</th>
                  <th className={`${TH} text-left`}>Entrenador</th>
                  <th className={`${TH} text-center`}>Reservadas</th>
                  <th className={`${TH} text-center`}>Asistieron</th>
                  <th className={`${TH} text-right`}>Tasa</th>
                </tr></thead>
                <tbody >
                  {asistencia.detalle.map(d => (
                    <tr key={`${d.clase}-${d.entrenador}`}>
                      <td className="py-3 font-medium text-[color:var(--rx-ink)]">{d.clase}</td>
                      <td className="py-3 text-[color:var(--rx-ink-secondary)]">{d.entrenador}</td>
                      <td className="py-3 text-center text-[color:var(--rx-ink-secondary)]">{d.reservadas}</td>
                      <td className="py-3 text-center text-[color:var(--rx-ink)] font-semibold">{d.asistieron}</td>
                      <td className="py-3 text-right text-[color:var(--rx-ink)] font-semibold">{pct(d.tasaAsistencia)}</td>
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
            <h3 className="rx-card-title">Existencias por producto</h3>
            <p className="text-xs text-[color:var(--rx-ink-muted)] mb-4">Las existencias son las de hoy; el rango de fechas solo afecta a las mermas.</p>
            {!inventario || inventario.productos.length === 0 ? (
              <SinDatos texto={textoVacio('Sin productos registrados')} />
            ) : (
              <table className="rx-table rx-reports-table">
                <thead><tr className="border-b border-[var(--rx-line)]">
                  <th className={`${TH} text-left`}>Producto</th>
                  <th className={`${TH} text-left`}>Categoría</th>
                  <th className={`${TH} text-center`}>Stock</th>
                  <th className={`${TH} text-center`}>Mínimo</th>
                  <th className={`${TH} text-right`}>Valor al precio</th>
                </tr></thead>
                <tbody >
                  {inventario.productos.map(p => (
                    <tr key={p.id}>
                      <td className="py-3 font-medium text-[color:var(--rx-ink)]">{p.nombre}<span className="block text-xs text-[color:var(--rx-ink-muted)]">{p.codigo}</span></td>
                      <td className="py-3 text-[color:var(--rx-ink-secondary)]">{p.categoria}</td>
                      <td className="py-3 text-center">
                        <span className={p.stock <= p.stockMinimo ? 'text-[color:var(--rx-danger)] font-semibold' : 'text-[color:var(--rx-ink-secondary)] font-medium'}>{p.stock}</span>
                      </td>
                      <td className="py-3 text-center text-[color:var(--rx-ink-muted)]">{p.stockMinimo}</td>
                      <td className="py-3 text-right text-[color:var(--rx-ink-secondary)]">{dinero(p.stock * p.precio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={CARD}>
            <h3 className="rx-card-title">Mermas del periodo</h3>
            {!inventario || inventario.mermas.length === 0 ? (
              <SinDatos texto={textoVacio('Sin mermas registradas en este rango')} />
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {inventario.mermasPorMotivo.map(m => (
                    <span key={m.motivo} className="px-3 py-1 rounded-full bg-[var(--rx-surface-soft)] text-xs text-[color:var(--rx-ink-secondary)]">
                      {m.motivo}: {m.unidades} u · {dinero(m.perdida)}
                    </span>
                  ))}
                </div>
                <table className="rx-table rx-reports-table">
                  <thead><tr className="border-b border-[var(--rx-line)]">
                    <th className={`${TH} text-left`}>Folio</th>
                    <th className={`${TH} text-left`}>Producto</th>
                    <th className={`${TH} text-center`}>Cantidad</th>
                    <th className={`${TH} text-left`}>Motivo</th>
                    <th className={`${TH} text-right`}>Pérdida</th>
                    <th className={`${TH} text-right`}>Fecha</th>
                  </tr></thead>
                  <tbody >
                    {inventario.mermas.map(m => (
                      <tr key={m.id}>
                        <td className="py-3 text-[color:var(--rx-ink-secondary)]">{m.folio}</td>
                        <td className="py-3 font-medium text-[color:var(--rx-ink)]">{m.producto}</td>
                        <td className="py-3 text-center text-[color:var(--rx-danger)] font-semibold">-{m.cantidad}</td>
                        <td className="py-3 text-[color:var(--rx-ink-secondary)]">{m.motivo}</td>
                        <td className="py-3 text-right text-[color:var(--rx-ink-secondary)]">{dinero(m.perdida)}</td>
                        <td className="py-3 text-right text-[color:var(--rx-ink-muted)]">{m.fecha}</td>
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
            <h3 className="rx-card-title">Asistencia del personal</h3>
            {!personal || personal.porEmpleado.length === 0 ? (
              <SinDatos texto={textoVacio('Sin empleados registrados')} />
            ) : (
              <table className="rx-table rx-reports-table">
                <thead><tr className="border-b border-[var(--rx-line)]">
                  <th className={`${TH} text-left`}>Empleado</th>
                  <th className={`${TH} text-left`}>Rol</th>
                  <th className={`${TH} text-center`}>Puntuales</th>
                  <th className={`${TH} text-center`}>Retardos</th>
                  <th className={`${TH} text-center`}>Faltas</th>
                  <th className={`${TH} text-right`}>% Asistencia</th>
                </tr></thead>
                <tbody >
                  {personal.porEmpleado.map(p => (
                    <tr key={p.codigo}>
                      <td className="py-3 font-medium text-[color:var(--rx-ink)]">{p.nombre}<span className="block text-xs text-[color:var(--rx-ink-muted)]">{p.codigo}</span></td>
                      <td className="py-3 text-[color:var(--rx-ink-secondary)] capitalize">{p.rol}</td>
                      <td className="py-3 text-center text-[color:var(--rx-success)] font-semibold">{p.puntuales}</td>
                      <td className="py-3 text-center text-[color:var(--rx-warning)] font-semibold">{p.retardos}</td>
                      <td className="py-3 text-center text-[color:var(--rx-danger)] font-semibold">{p.faltas}</td>
                      <td className="py-3 text-right">
                        <span className={`font-semibold ${p.asistenciaPct === null ? 'text-[color:var(--rx-ink-muted)]' : p.asistenciaPct >= 90 ? 'text-[color:var(--rx-success)]' : p.asistenciaPct >= 70 ? 'text-[color:var(--rx-warning)]' : 'text-[color:var(--rx-danger)]'}`}>
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
            <h3 className="rx-card-title">Registro de asistencia detallado</h3>
            {!personal || personal.registros.length === 0 ? (
              <SinDatos texto={textoVacio('Sin registros en este rango')} />
            ) : (
              <>
                <table className="rx-table rx-reports-table">
                  <thead><tr className="border-b border-[var(--rx-line)]">
                    <th className={`${TH} text-left`}>Empleado</th>
                    <th className={`${TH} text-left`}>Fecha</th>
                    <th className={`${TH} text-left`}>Entrada</th>
                    <th className={`${TH} text-left`}>Salida</th>
                    <th className={`${TH} text-center`}>Estado</th>
                  </tr></thead>
                  <tbody >
                    {personal.registros.map(r => {
                      const estado = r.estado ? ESTADO_PERSONAL[r.estado] : undefined;
                      return (
                        <tr key={`${r.codigo}-${r.fecha}`}>
                          <td className="py-3 font-medium text-[color:var(--rx-ink)]">{r.nombre}</td>
                          <td className="py-3 text-[color:var(--rx-ink-secondary)]">{r.fecha}</td>
                          <td className="py-3 text-[color:var(--rx-ink-secondary)]">{r.entrada ?? '—'}</td>
                          <td className="py-3 text-[color:var(--rx-ink-secondary)]">{r.salida ?? '—'}</td>
                          <td className="py-3 text-center">
                            {estado ? (
                              <span className={estado.clase}>{estado.texto}</span>
                            ) : (
                              <span className="text-[color:var(--rx-line-strong)]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {personal.registrosTruncados && (
                  <p className="text-xs text-[color:var(--rx-ink-muted)] mt-3">Se muestran los 500 registros más recientes del rango.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}