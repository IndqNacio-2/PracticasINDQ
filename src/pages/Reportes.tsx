import { useState } from 'react';
import { admin } from '../lib/api';
import { claveDia, deClave, DOW, fechaCorta, hora12, money, sumarDias } from '../lib/format';
import { Icon } from '../ui/Icon';
import { Cargando, ErrorBox, Kpis, SecHead, useCarga, type KpiItem } from '../ui/kit';
import { MOTIVOS } from './Merma';

type Tipo = 'ventas' | 'asistencia-clases' | 'visitas' | 'inventario' | 'personal';
const TIPOS: [Tipo, string, string][] = [
  ['ventas', 'Ventas', 'Punto de venta: por día, hora, categoría y producto.'],
  ['asistencia-clases', 'Asistencia a clases', 'Reservaciones, asistencias e inasistencias por clase y coach.'],
  ['visitas', 'Visitas', 'Entradas de clientes registradas en el checador.'],
  ['inventario', 'Inventario', 'Existencias actuales y mermas del periodo.'],
  ['personal', 'Personal', 'Puntualidad, retardos y faltas del equipo.'],
];
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0) || 0);
const pct = (v: unknown) => `${Math.round(n(v))}%`;

function Barras({ filas, etiqueta, valor, fmt = (x: number) => String(x), color = 'var(--accent)' }: { filas: Record<string, unknown>[]; etiqueta: (f: Record<string, unknown>) => string; valor: (f: Record<string, unknown>) => number; fmt?: (x: number) => string; color?: string }) {
  const mx = Math.max(1, ...filas.map(valor));
  if (!filas.length) return <div className="dempty">Sin datos en el periodo.</div>;
  return (
    <div className="hbars" style={{ margin: '6px 0 0' }}>
      {filas.map((f, i) => (
        <div className="hb" key={i}><div className="hbl"><span>{etiqueta(f)}</span><b>{fmt(valor(f))}</b></div>
          <div className="hbt" style={{ background: 'var(--card2)' }}><i style={{ width: `${Math.max(2, (valor(f) / mx) * 100)}%`, background: color }} /></div></div>
      ))}
    </div>
  );
}

function exportarCSV(nombre: string, filas: Record<string, unknown>[]) {
  if (!filas.length) return;
  const cols = Object.keys(filas[0]);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + [cols.join(','), ...filas.map((f) => cols.map((c) => esc(typeof f[c] === 'object' ? JSON.stringify(f[c]) : f[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${nombre}.csv`;
  a.click();
}

export default function Reportes() {
  const [tipo, setTipo] = useState<Tipo>('ventas');
  const [desde, setDesde] = useState(claveDia(sumarDias(new Date(), -29)));
  const [hasta, setHasta] = useState(claveDia(new Date()));
  const { data, error, loading, recargar } = useCarga(() => admin.get<Record<string, any>>(`/reportes/${tipo}?desde=${desde}&hasta=${hasta}`), [tipo, desde, hasta]);
  const r = data ?? {};
  const s = r.resumen ?? {};

  const rapido = (dias: number) => { setDesde(claveDia(sumarDias(new Date(), -(dias - 1)))); setHasta(claveDia(new Date())); };
  const diaCorto = (f: unknown) => { const d = deClave(String(f)); return `${DOW[d.getDay()]} ${d.getDate()}`; };

  let kpis: KpiItem[] = [];
  let cuerpo: React.ReactNode = null;
  let tabla: Record<string, unknown>[] = [];
  if (tipo === 'ventas') {
    kpis = [
      { label: 'Total vendido', value: money(s.totalVentas), tono: 'accent', icon: 'dinero' },
      { label: 'Tickets', value: n(s.transacciones), tono: 'blue', icon: 'imprimir' },
      { label: 'Ticket promedio', value: money(s.ticketPromedio), tono: 'purple', icon: 'etiqueta' },
      { label: 'Unidades vendidas', value: n(s.unidadesVendidas), tono: 'ok', icon: 'inventario' },
      { label: 'Producto más vendido', value: <span style={{ fontSize: 17 }}>{s.productoTop ?? '—'}</span>, tono: 'warn', icon: 'reportes' },
    ];
    tabla = r.productos ?? [];
    cuerpo = (
      <div className="drow2 drow3">
        <div className="dc"><div className="dsech"><h3>Ventas por día</h3></div><Barras filas={(r.porDia ?? []).slice(-14)} etiqueta={(f) => diaCorto(f.fecha)} valor={(f) => n(f.ventas)} fmt={money} /></div>
        <div className="dc"><div className="dsech"><h3>Ventas por hora</h3></div><Barras filas={(r.porHora ?? []).filter((f: any) => n(f.ventas) > 0)} etiqueta={(f) => hora12(`${f.hora}:00`)} valor={(f) => n(f.ventas)} fmt={money} color="var(--purple)" /></div>
        <div className="dc"><div className="dsech"><h3>Por categoría</h3></div><Barras filas={r.porCategoria ?? []} etiqueta={(f) => String(f.categoria ?? f.nombre ?? '')} valor={(f) => n(f.total)} fmt={money} color="var(--blue)" /></div>
      </div>
    );
  } else if (tipo === 'asistencia-clases') {
    kpis = [
      { label: 'Reservadas', value: n(s.reservadas), tono: 'blue', icon: 'reservaciones' },
      { label: 'Asistieron', value: n(s.asistieron), tono: 'ok', icon: 'on' },
      { label: 'No asistieron', value: n(s.noAsistieron), tono: 'warn', icon: 'inasistencia' },
      { label: 'Canceladas', value: n(s.canceladas), tono: 'bad', icon: 'off' },
      { label: 'Tasa de asistencia', value: pct(s.tasaAsistencia ?? s.asistenciaPct ?? (n(s.reservadas) ? (n(s.asistieron) / n(s.reservadas)) * 100 : 0)), tono: 'purple', icon: 'reportes' },
    ];
    tabla = r.detalle ?? [];
    cuerpo = (
      <div className="drow2 drow3" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
        <div className="dc"><div className="dsech"><h3>Asistencias por clase</h3></div><Barras filas={r.porClase ?? []} etiqueta={(f) => String(f.clase)} valor={(f) => n(f.asistieron)} color="var(--ok)" /></div>
        <div className="dc"><div className="dsech"><h3>Asistencias por coach</h3></div><Barras filas={r.porEntrenador ?? []} etiqueta={(f) => String(f.entrenador)} valor={(f) => n(f.asistieron)} color="var(--blue)" /></div>
      </div>
    );
  } else if (tipo === 'visitas') {
    kpis = [
      { label: 'Visitas', value: n(s.totalVisitas), tono: 'blue', icon: 'checador' },
      { label: 'Clientes distintos', value: n(s.visitantesUnicos), tono: 'ok', icon: 'clientes' },
      { label: 'Promedio diario', value: n(s.promedioDiario), tono: 'purple', icon: 'reportes' },
      { label: 'Día con más visitas', value: <span style={{ fontSize: 18 }}>{s.diaPico ? fechaCorta(s.diaPico.fecha) : '—'}</span>, tono: 'accent', icon: 'calendario' },
      { label: 'Hora pico', value: s.horaPico ? hora12(`${s.horaPico.hora}:00`) : '—', tono: 'warn', icon: 'reloj' },
    ];
    tabla = r.porDia ?? [];
    cuerpo = (
      <div className="drow2 drow3" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
        <div className="dc"><div className="dsech"><h3>Visitas por día</h3></div><Barras filas={(r.porDia ?? []).slice(-14)} etiqueta={(f) => diaCorto(f.fecha)} valor={(f) => n(f.visitas)} /></div>
        <div className="dc"><div className="dsech"><h3>Visitas por hora</h3></div><Barras filas={(r.porHora ?? []).filter((f: any) => n(f.visitas) > 0)} etiqueta={(f) => hora12(`${f.hora}:00`)} valor={(f) => n(f.visitas)} color="var(--purple)" /></div>
      </div>
    );
  } else if (tipo === 'inventario') {
    kpis = [
      { label: 'Productos activos', value: n(s.productosActivos), tono: 'ok', icon: 'inventario' },
      { label: 'Unidades en stock', value: n(s.totalUnidades), tono: 'blue', icon: 'cuadros' },
      { label: 'Valor al precio', value: money(s.valorAlPrecio), tono: 'accent', icon: 'dinero' },
      { label: 'Stock bajo o agotado', value: n(s.conPocoStock) + n(s.agotados), tono: 'warn', icon: 'alerta' },
      { label: 'Pérdida por merma', value: money(s.mermasPerdida), tono: 'bad', icon: 'merma' },
    ];
    tabla = r.productos ?? [];
    const porMotivo = Object.values((r.mermas ?? []).reduce((a: Record<string, any>, m: any) => { const k = m.motivo; a[k] ??= { motivo: MOTIVOS.find(([x]) => x === k)?.[1] ?? k, perdida: 0 }; a[k].perdida += n(m.perdida); return a; }, {})) as Record<string, unknown>[];
    cuerpo = (
      <div className="drow2 drow3" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
        <div className="dc"><div className="dsech"><h3>Stock por producto</h3></div><Barras filas={[...(r.productos ?? [])].sort((a: any, b: any) => n(b.stock) - n(a.stock)).slice(0, 10)} etiqueta={(f) => String(f.nombre)} valor={(f) => n(f.stock)} color="var(--blue)" /></div>
        <div className="dc"><div className="dsech"><h3>Merma por motivo</h3></div><Barras filas={porMotivo} etiqueta={(f) => String(f.motivo)} valor={(f) => n(f.perdida)} fmt={money} color="var(--bad)" /></div>
      </div>
    );
  } else {
    kpis = [
      { label: 'Empleados', value: n(s.empleados), tono: 'blue', icon: 'grupo' },
      { label: 'Llegadas puntuales', value: n(s.puntuales), tono: 'ok', icon: 'on' },
      { label: 'Retardos', value: n(s.retardos), tono: 'warn', icon: 'reloj' },
      { label: 'Faltas', value: n(s.faltas), tono: 'bad', icon: 'off' },
      { label: 'Asistencia', value: pct(s.asistenciaPct), tono: 'purple', icon: 'reportes' },
    ];
    tabla = r.porEmpleado ?? [];
    cuerpo = <div className="dc"><div className="dsech"><h3>Asistencia por empleado</h3>{r.clasificacionDisponible === false && <span className="dcount">Turnos sin configurar</span>}</div>
      <Barras filas={r.porEmpleado ?? []} etiqueta={(f) => String(f.nombre ?? f.codigo)} valor={(f) => n(f.asistenciaPct)} fmt={(x) => `${Math.round(x)}%`} color="var(--ok)" /></div>;
  }
  const cols = tabla.length ? Object.keys(tabla[0]).filter((k) => typeof tabla[0][k] !== 'object').slice(0, 8) : [];

  return (
    <>
      <div className="vsw" role="tablist" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        {TIPOS.map(([k, t, d]) => <button key={k} role="tab" className={tipo === k ? 'on' : ''} onClick={() => setTipo(k)}><b>{t}</b><small>{d}</small></button>)}
      </div>
      <SecHead title={TIPOS.find(([k]) => k === tipo)![1]}>
        <div className="nu-range">
          <label className="selsm"><span>Desde</span><input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} /></label>
          <label className="selsm"><span>Hasta</span><input type="date" value={hasta} min={desde} max={claveDia(new Date())} onChange={(e) => setHasta(e.target.value)} /></label>
        </div>
        <div className="per" style={{ borderLeft: 'none' }}><button onClick={() => rapido(1)}>Hoy</button><button onClick={() => rapido(7)}>7 días</button><button onClick={() => rapido(30)}>30 días</button></div>
        <button className="btn ghost2" style={{ marginLeft: 'auto' }} disabled={!tabla.length} onClick={() => exportarCSV(`reporte-${tipo}-${desde}-a-${hasta}`, tabla)}><Icon n="descargar" />Exportar CSV</button>
      </SecHead>
      {error && <ErrorBox mensaje={error} onRetry={recargar} />}
      {loading ? <Cargando /> : (
        <>
          <Kpis items={kpis} />
          {cuerpo}
          {tabla.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <SecHead title="Detalle" />
              <div style={{ overflowX: 'auto' }}>
                <table><thead><tr>{cols.map((c) => <th key={c}>{c.replace(/([A-Z])/g, ' $1').toLowerCase()}</th>)}</tr></thead>
                  <tbody>{tabla.slice(0, 200).map((f, i) => <tr className="r" key={i}>{cols.map((c) => <td key={c} className="fade">{typeof f[c] === 'number' && /total|ventas|precio|costo|perdida|valor|importe/i.test(c) ? money(n(f[c])) : String(f[c] ?? '')}</td>)}</tr>)}</tbody></table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
