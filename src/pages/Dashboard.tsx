import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin } from '../lib/api';
import { claveDia, deClave, DOW, hoy, money, sumarDias } from '../lib/format';
import { useSesion } from '../shell/AppShell';
import { Icon, type IconName } from '../ui/Icon';
import { Cargando, ErrorBox, TONO, useCarga, useFeedback, type Tono } from '../ui/kit';
import { clientes as apiClientes, membresiaDe, reservaciones } from '../lib/datos';
import type { Horario } from './Reservaciones';
import type { Movimiento, Producto } from './Inventario';

const MF = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const M3 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const kfmt = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`);

function Ring({ pct, color, children }: { pct: number; color: string; children: React.ReactNode }) {
  const size = 88, sw = 9, r = (size - sw) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, pct));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`}><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} strokeOpacity={v > 0 ? 1 : 0} /></svg>
      <span>{children}</span>
    </div>
  );
}
function Spark({ vals, col }: { vals: number[]; col: string }) {
  const w = 150, h = 64, mx = Math.max(...vals, 1), st = w / Math.max(1, vals.length - 1);
  const pts = vals.map((v, i) => [i * st, h - 4 - (v / mx) * (h - 10)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const id = `spg${col.slice(1)}`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`}>
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={col} stopOpacity=".35" /><stop offset="1" stopColor={col} stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L${w} ${h} L0 ${h}Z`} fill={`url(#${id})`} /><path d={d} fill="none" stroke={col} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0] - 1.5} cy={pts[pts.length - 1][1]} r="3" fill={col} />
    </svg>
  );
}

export default function Dashboard() {
  const yo = useSesion();
  const nav = useNavigate();
  const { toast } = useFeedback();
  const anio = new Date().getFullYear();
  const { data, error, loading, recargar } = useCarga(async () => {
    const lunes = sumarDias(hoy(), -((hoy().getDay() + 6) % 7));
    const todos = await admin.get<Horario[]>('/horarios?estatus=activo');
    const [clientes, res, horarios, productos, movs, ingresos] = await Promise.all([
      apiClientes.listar(),
      reservaciones.listar(todos).catch(() => []),
      Promise.resolve(todos),
      admin.get<Producto[]>('/productos').catch(() => [] as Producto[]),
      admin.get<Movimiento[]>(`/movimientos?limit=2000&desde=${claveDia(new Date(anio, new Date().getMonth(), 1))}`).catch(() => [] as Movimiento[]),
      admin.get<{ fecha: string; total: number; origen: string }[]>(`/dashboard/ingresos?desde=${anio}-01-01&hasta=${claveDia(new Date())}`).catch(() => []),
    ]);
    return { clientes, res, horarios: horarios.filter((h) => deClave(h.fecha) >= lunes && deClave(h.fecha) < sumarDias(lunes, 7)), productos, movs, ingresos };
  });
  const [banner, setBanner] = useState(() => localStorage.getItem('nuHero') !== '0');
  useEffect(() => { localStorage.setItem('nuHero', banner ? '1' : '0'); }, [banner]);
  const plotRef = useRef<HTMLDivElement>(null);
  const [linea, setLinea] = useState<{ w: number; h: number; pts: number[][] } | null>(null);

  const t0 = hoy(), hk = claveDia(t0), ahora = new Date();
  const C = data?.clientes ?? [], R = data?.res ?? [], H = data?.horarios ?? [];
  const cAct = C.filter((c) => c.estatus === 'activo').length;
  const deHoy = R.filter((r) => r.fechaClase === hk), vivas = deHoy.filter((r) => r.estatus !== 'cancelada');
  const sesHoy = H.filter((h) => h.fecha === hk);
  const capHoy = sesHoy.reduce((a, h) => a + h.capacidadTotal, 0);
  const canc = deHoy.filter((r) => r.estatus === 'cancelada').length;
  const ventasDia = (d: Date) => (data?.ingresos ?? []).filter((i) => i.fecha === claveDia(d)).reduce((a, i) => a + i.total, 0);
  const wk = [6, 5, 4, 3, 2, 1, 0].map((k) => ventasDia(sumarDias(t0, -k)));
  const conMem = C.filter((c) => c.estatus === 'activo' && (membresiaDe(c)?.fechaFin ?? '') >= hk).length;
  const porVencer = C.filter((c) => { const f = membresiaDe(c)?.fechaFin; return c.estatus === 'activo' && !!f && f >= hk && f <= claveDia(sumarDias(t0, 7)); }).length;

  const MET: [string, Tono, IconName, string, string, React.ReactNode][] = [
    ['Clientes activos', 'purple', 'clientes', String(cAct), `de ${C.length} clientes registrados`, <Ring pct={C.length ? cAct / C.length : 0} color="var(--purple)">{C.length ? Math.round((cAct / C.length) * 100) : 0}%</Ring>],
    ['Con membresía vigente', 'ok', 'membresias', String(conMem), `de ${cAct} clientes activos`, <Ring pct={cAct ? conMem / cAct : 0} color="var(--ok)">{cAct ? Math.round((conMem / cAct) * 100) : 0}%</Ring>],
    ['Ocupación general', 'blue', 'grupo', String(vivas.length), `de ${capHoy} lugares disponibles`, <Ring pct={capHoy ? vivas.length / capHoy : 0} color="var(--blue)">{capHoy ? Math.round((vivas.length / capHoy) * 100) : 0}%</Ring>],
    ['Cancelaciones', 'bad', 'off', String(canc), `de ${deHoy.length} reservaciones del día`, <Ring pct={deHoy.length ? canc / deHoy.length : 0} color="var(--bad)">{deHoy.length ? Math.round((canc / deHoy.length) * 100) : 0}%</Ring>],
    ['Ventas de hoy', 'accent', 'venta', money(wk[6]), 'Punto de venta y recepción', <Spark vals={wk} col="#E8782F" />],
  ];

  // Ingresos por mes del año
  const porMes = Array.from({ length: 12 }, (_, m) => (data?.ingresos ?? []).filter((i) => deClave(i.fecha).getMonth() === m).reduce((a, i) => a + i.total, 0));
  const cm = t0.getMonth(), f0 = Math.max(0, porMes.findIndex((v) => v > 0));
  const conDatos = porMes.slice(f0, cm + 1);
  const ytd = conDatos.reduce((a, b) => a + b, 0);
  const meses = cm - f0 + t0.getDate() / new Date(t0.getFullYear(), cm + 1, 0).getDate();
  const best = conDatos.length ? f0 + conDatos.indexOf(Math.max(...conDatos)) : cm;
  const mx = Math.max(...porMes, 1), stp = Math.max(1000, Math.ceil((mx * 1.1) / 4 / 1000) * 1000), top = stp * 4, ticks = [4, 3, 2, 1, 0].map((k) => k * stp);

  useLayoutEffect(() => {
    const pl = plotRef.current;
    if (!pl) return;
    const calc = () => {
      const r0 = pl.getBoundingClientRect();
      const pts = [...pl.querySelectorAll('.icol:not(.fut):not(.vacio) .istk')].map((b) => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2 - r0.left, r.top - r0.top - 9]; });
      setLinea(pts.length > 1 ? { w: r0.width, h: r0.height, pts } : null);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [data]);

  // Ocupación de la semana (lunes a sábado)
  const lunes = sumarDias(t0, -((t0.getDay() + 6) % 7));
  const semana = Array.from({ length: 6 }, (_, i) => { const d = sumarDias(lunes, i), k = claveDia(d); return { d, cap: H.filter((h) => h.fecha === k).reduce((a, h) => a + h.capacidadTotal, 0), res: R.filter((r) => r.fechaClase === k && r.estatus !== 'cancelada').length }; });
  const mxS = Math.max(1, ...semana.map((x) => x.res)), hi = semana.find((x) => x.res === Math.max(...semana.map((y) => y.res)))!, lo = semana.find((x) => x.res === Math.min(...semana.map((y) => y.res)))!;
  const pp = (n: number) => `${n} persona${n === 1 ? '' : 's'}`;

  // Productos más y menos vendidos del mes
  const ventas = (data?.movs ?? []).filter((m) => m.origen === 'venta');
  const agg = new Map<string, number>();
  ventas.forEach((m) => m.idProducto && agg.set(m.idProducto, (agg.get(m.idProducto) ?? 0) + m.cantidad));
  const P = (data?.productos ?? []).filter((p) => p.estatus === 'activo');
  const topP = P.map((p) => ({ p, q: agg.get(p.idProducto) ?? 0 })).filter((o) => o.q > 0).sort((a, b) => b.q - a.q).slice(0, 4);
  const lowP = P.map((p) => ({ p, q: agg.get(p.idProducto) ?? 0 })).sort((a, b) => a.q - b.q || a.p.nombre.localeCompare(b.p.nombre, 'es')).slice(0, 4);

  const hr = ahora.getHours();
  const saludo = `${hr < 12 ? 'Buenos días' : hr < 19 ? 'Buenas tardes' : 'Buenas noches'}, ${yo.nombre}`;

  if (loading) return <Cargando />;
  return (
    <>
      {error && <ErrorBox mensaje={error} onRetry={recargar} />}
      <div className={`hshow ${banner ? '' : 'on'}`}><button className="dlink" onClick={() => setBanner(true)}>Mostrar banner</button></div>
      <div className={`hero ${banner ? '' : 'off'}`} style={{ marginBottom: 22 }}>
        <div className="himg" />
        <button className="hx" aria-label="Ocultar banner" data-tip="Ocultar banner" onClick={() => { setBanner(false); toast('Banner oculto', 'Puedes volver a mostrarlo cuando quieras.'); }}><Icon n="x" w={2.2} /></button>
        <div className="htx">
          <span className="hlbl">Hybrid Training Club</span>
          <h2>{saludo}</h2>
          <p>{sesHoy.length ? <>Hoy hay <b>{vivas.length} {vivas.length === 1 ? 'reservación' : 'reservaciones'}</b> en {sesHoy.length} {sesHoy.length === 1 ? 'clase' : 'clases'}. </> : 'Hoy no hay clases programadas. '}
            {porVencer ? <><b>{porVencer} {porVencer === 1 ? 'membresía vence' : 'membresías vencen'}</b> en los próximos 7 días.</> : 'Ninguna membresía vence en los próximos 7 días.'}</p>
          <div className="hbtns">
            <button className="btn acc" onClick={() => nav('/reservaciones')}>Ver reservaciones<Icon n="flechaDer" /></button>
            <button className="btn glass" onClick={() => nav('/usuarios')}><Icon n="grupo" />Ver usuarios</button>
          </div>
        </div>
      </div>

      <div className="dgrid"><div className="dmain">
        <div className="dmets" id="dMets">
          {MET.map(([l, t, ic, v, s, viz]) => (
            <div className="dc dmet" key={l}>
              <div className="dmh"><span className="ki" style={{ background: TONO[t][0], color: TONO[t][1] }}><Icon n={ic} /></span>{l}<span className="pill st-asis htag">Hoy</span></div>
              <div className="dmrow"><div className="dmb"><b>{v}</b><small>{s}</small></div><div className="dviz">{viz}</div></div>
            </div>
          ))}
        </div>

        <div className="dinc">
          <div className="dsec dincc">
            <div className="ihead"><div><h3>Ingresos del año {anio}</h3><p>Punto de venta y cobros de recepción, por mes</p></div></div>
            {ytd ? (
              <div className="ichart">
                <div className="iyax">{ticks.map((t) => <span key={t}>{kfmt(t)}</span>)}</div>
                <div className="iplot" ref={plotRef}>
                  <div className="igrid">{ticks.map((t) => <i key={t} />)}</div>
                  {porMes.map((v, m) => m < f0 ? <div className="icol vacio" key={m} /> : m > cm ? <div className="icol fut" key={m}><div className="istk" /></div> : (
                    <div className={`icol ${m === cm ? 'cur' : ''}`} key={m}>
                      <div className="istk" style={{ height: `${(v / top) * 100}%` }}><span className="ival">{kfmt(v)}</span></div>
                      <div className="itip"><b>{MF[m]} {anio}{m === cm ? ' · en curso' : ''}</b><span>Total<em>{money(v)}</em></span></div>
                    </div>
                  ))}
                  {linea && <svg className="iline" width={linea.w} height={linea.h}><polyline points={linea.pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--ink3)" strokeWidth="1.5" strokeDasharray="2 5" strokeLinecap="round" strokeLinejoin="round" />
                    {linea.pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="var(--bg)" stroke="var(--accent)" strokeWidth="1.5" />)}</svg>}
                </div>
                <div /><div className="ixax">{M3.map((n, m) => <span key={n} className={m === cm ? 'cur' : ''}>{n}</span>)}</div>
              </div>
            ) : <div className="incempty"><b>Aún no hay ingresos registrados</b>Aquí verás los ingresos de cada mes cuando se registren ventas de membresías o en punto de venta.</div>}
          </div>
          <div className="istack">
            {([['Promedio mensual', 'blue', 'reportes', money(Math.round(ytd / Math.max(1, meses) / 100) * 100), `${MF[f0]} a ${MF[cm].toLowerCase()} ${anio}`],
              ['Acumulado del año', 'ok', 'dinero', money(ytd), `${conDatos.length} meses · ${MF[cm].toLowerCase()} en curso`],
              ['Mejor mes', 'accent', 'etiqueta', ytd ? MF[best] : '—', ytd ? `${money(porMes[best])} en ingresos` : 'Sin ingresos todavía']] as [string, Tono, IconName, string, string][]).map(([l, t, ic, v, s]) => (
              <div className="dc ik" key={l}><div className="ikh"><span className="ki" style={{ background: TONO[t][0], color: TONO[t][1] }}><Icon n={ic} /></span>{l}</div><div><b>{v}</b><small>{s}</small></div></div>
            ))}
          </div>
        </div>

        <div className="drow2 drow3">
          <div className="dc dmem" id="dOcc">
            <div className="dsech" style={{ marginBottom: 6 }}><h3>Ocupación de la semana</h3><span className="oavg">{Math.round(semana.reduce((a, x) => a + x.res, 0) / 6)}<small>personas por día</small></span></div>
            <div className="hbars">{semana.map((x, i) => { const td = claveDia(x.d) === hk; return (
              <div className={`hb ${td ? 'today' : ''}`} key={i} title={`${pp(x.res)} de ${x.cap} lugares`}><div className="hbl"><span>{td ? 'Hoy' : ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][i]}</span><b>{pp(x.res)}</b></div>
                <div className="hbt"><i style={{ width: `${Math.max(4, (x.res / mxS) * 100)}%` }} /></div></div>); })}</div>
            <div className="oleg"><span>Más afluencia: <b>{DOW[hi.d.getDay()]} · {pp(hi.res)}</b></span><span>Menos afluencia: <b>{DOW[lo.d.getDay()]} · {pp(lo.res)}</b></span></div>
          </div>
          <div className="dc dtop">
            <div className="dsech"><h3 className="dih"><span className="si"><Icon n="inventario" /></span>Productos más vendidos</h3><span className="dcount">Este mes</span></div>
            {topP.length ? topP.map((o, i) => <div className="tpi" key={o.p.idProducto}><span className="rk">{i + 1}</span><div><b>{o.p.nombre}</b><small>{o.p.categoria}</small></div><div className="qn">{o.q} vendidos<small>{money(o.q * o.p.precio)}</small></div></div>)
              : <div className="dempty">Aún no hay ventas este mes.</div>}
            <div className="bdmore"><button className="dlink" onClick={() => nav('/inventario')}>Ver inventario</button></div>
          </div>
          <div className="dc dtop dlow">
            <div className="dsech"><h3 className="dih"><span className="si"><Icon n="inventario" /></span>Productos menos vendidos</h3><span className="dcount">Este mes</span></div>
            {lowP.length ? lowP.map((o, i) => <div className="tpi low" key={o.p.idProducto}><span className="rk">{i + 1}</span><div><b>{o.p.nombre}</b><small>{o.p.categoria}</small></div><div className="qn">{o.q ? `${o.q} vendido${o.q === 1 ? '' : 's'}` : 'Sin ventas'}<small>{money(o.q * o.p.precio)}</small></div></div>)
              : <div className="dempty">No hay productos activos.</div>}
            <div className="bdmore"><button className="dlink" onClick={() => nav('/inventario')}>Ver inventario</button></div>
          </div>
        </div>
      </div></div>
    </>
  );
}
