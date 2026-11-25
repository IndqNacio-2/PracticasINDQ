import { useMemo, useState } from 'react';
import { admin } from '../lib/api';
import { fechaRelativa, horaDe, iniciales, money, norm } from '../lib/format';
import { useSesion } from '../shell/AppShell';
import { Icon } from '../ui/Icon';
import { Cargando, EmptyRow, ErrorBox, Kpis, Periodo, Search, SecHead, Tabs, useCarga } from '../ui/kit';
import { conceptoMov, MovimientoDrawer, tipoMov, type Movimiento, type Producto } from './Inventario';

const TY = { in: 'Entrada', sale: 'Venta', loss: 'Merma o ajuste' } as const;

export default function Movimientos() {
  const yo = useSesion();
  const editable = yo.rol !== 'recepcion';
  const { data, error, loading, recargar } = useCarga(async () => {
    const [movs, productos] = await Promise.all([admin.get<Movimiento[]>('/movimientos?limit=2000'), admin.get<Producto[]>('/productos')]);
    return { movs, productos };
  });
  const [q, setQ] = useState('');
  const [per, setPer] = useState<'today' | '7' | 'month' | 'all'>('month');
  const [tab, setTab] = useState<'all' | 'in' | 'sale' | 'loss'>('all');
  const [n, setN] = useState(20);
  const [mov, setMov] = useState(false);
  const P = data?.productos ?? [];

  // Stock antes/después: se reconstruye hacia atrás desde el stock actual de cada producto.
  const conStock = useMemo(() => {
    const actual = new Map(P.map((p) => [p.idProducto, p.stock]));
    return (data?.movs ?? []).map((m) => {
      const t = tipoMov(m), after = m.idProducto ? actual.get(m.idProducto) ?? null : null;
      const before = after === null ? null : after - (t === 'in' ? m.cantidad : -m.cantidad);
      if (m.idProducto && before !== null) actual.set(m.idProducto, before);
      return { ...m, t, before, after };
    });
  }, [data, P]);

  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const enRango = (d: Date) => per === 'today' ? d >= t0 : per === '7' ? d >= new Date(t0.getTime() - 6 * 864e5) : per === 'month' ? d >= new Date(t0.getFullYear(), t0.getMonth(), 1) : true;
  const R = conStock.filter((m) => enRango(new Date(m.fechaHora)));
  const Q = R.filter((m) => !q || norm(`${m.nombreProducto} ${conceptoMov(m)} ${m.registro}`).includes(norm(q)));
  const L = Q.filter((m) => tab === 'all' || m.t === tab);
  const suma = (t: string, fn = (m: typeof R[number]) => m.cantidad) => R.filter((m) => m.t === t).reduce((a, m) => a + fn(m), 0);

  let ultimo = '';
  return (
    <>
      <Kpis items={[
        { label: 'Movimientos en el periodo', value: R.length, tono: 'blue', icon: 'movimientos' },
        { label: 'Unidades que entraron', value: suma('in'), tono: 'ok', icon: 'flechaArriba' },
        { label: 'Unidades vendidas', value: suma('sale'), tono: 'accent', icon: 'flechaAbajo' },
        { label: 'Ingresos por ventas', value: money(suma('sale', (m) => m.cantidad * (m.precioUnitario ?? P.find((p) => p.idProducto === m.idProducto)?.precio ?? 0))), tono: 'purple', icon: 'dinero' },
        { label: 'Unidades en merma o ajuste', value: suma('loss'), tono: 'bad', icon: 'alerta' },
      ]} />
      <SecHead title="Historial de movimientos">
        <Search value={q} onChange={(v) => { setQ(v); setN(20); }} placeholder="Buscar producto, concepto o usuario" />
        <Periodo style={{ marginLeft: 'auto', borderLeft: 'none' }} value={per} onChange={(v) => { setPer(v); setN(20); }} opciones={[['today', 'Hoy'], ['7', '7 días'], ['month', 'Este mes'], ['all', 'Todo']]} />
      </SecHead>
      <div className="tabrow">
        <Tabs value={tab} onChange={(v) => { setTab(v); setN(20); }} tabs={[['all', 'Todos', Q.length], ['in', 'Entradas', Q.filter((m) => m.t === 'in').length], ['sale', 'Ventas', Q.filter((m) => m.t === 'sale').length], ['loss', 'Mermas y ajustes', Q.filter((m) => m.t === 'loss').length]]} />
        {editable && <button className="btn acc" style={{ marginLeft: 'auto' }} onClick={() => setMov(true)}><Icon n="mas" w={2.4} />Registrar movimiento</button>}
      </div>
      {error && <ErrorBox mensaje={error} onRetry={recargar} />}
      <table className="htab">
        <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Concepto</th><th className="r">Cantidad</th><th className="c">Stock</th><th>Registró</th></tr></thead>
        <tbody>
          {loading ? <Cargando cols={7} /> : L.length ? L.slice(0, n).flatMap((m) => {
            const d = new Date(m.fechaHora), rel = fechaRelativa(d);
            const dia = rel === 'Hoy' || rel === 'Ayer' ? rel : d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
            const filas = [];
            if (dia !== ultimo) { filas.push(<tr className="hday" key={'d' + m.id}><td colSpan={7}>{dia}</td></tr>); ultimo = dia; }
            const inn = m.t === 'in';
            filas.push(
              <tr className="r" key={m.id}>
                <td><div className="hdate"><b>{horaDe(d)}</b></div></td>
                <td><div className="hprod"><b>{m.nombreProducto}</b><small>{m.categoria}</small></div></td>
                <td><span className={`pill t-${m.t}`}>{inn ? '↑' : '↓'} {TY[m.t]}</span></td>
                <td className="hcon" title={conceptoMov(m)}>{conceptoMov(m)}</td>
                <td className={`hqty ${inn ? 'qin' : 'qout'}`}>{inn ? '+' : '−'}{m.cantidad}</td>
                <td className="hstk">{m.before ?? '—'}<i>→</i><b>{m.after ?? '—'}</b></td>
                <td><div className="huser">{m.registro ? <><span className="av">{iniciales(m.registro)}</span>{m.registro}</> : <span className="none">Sin registro</span>}</div></td>
              </tr>,
            );
            return filas;
          }) : <EmptyRow cols={7} title="Sin movimientos" text="No hay movimientos con estos filtros en el periodo elegido." />}
        </tbody>
      </table>
      {L.length > n && <div className="hmore"><button className="btn glass" onClick={() => setN(n + 20)}>Mostrar más ({L.length - n} restantes)</button></div>}
      <MovimientoDrawer open={mov} productos={P} onClose={() => setMov(false)} onHecho={() => void recargar(true)} />
    </>
  );
}
