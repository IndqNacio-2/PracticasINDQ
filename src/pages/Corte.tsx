import { useState } from 'react';
import { admin, mensajeError, pos } from '../lib/api';
import { deDMY, fechaCorta, iniciales, money } from '../lib/format';
import type { Usuario } from '../lib/session';
import { useSesion } from '../shell/AppShell';
import { Icon } from '../ui/Icon';
import { Cargando, EmptyRow, ErrorBox, Field, Kpis, SecHead, useCarga, useFeedback } from '../ui/kit';
import type { Venta } from './Venta';

interface CorteReg { id: number; folio: string; date: string; time: string; salesCount: number; totalSales: number; cashSales: number; cardSales: number; transferSales: number; initialFund: number; expectedCash: number; countedCash: number; difference: number; registeredBy: string }
const r2 = (n: number) => Math.round(n * 100) / 100;
const FONDO_KEY = 'nu_fondo_caja';

export default function Corte() {
  const yo = useSesion();
  const { toast, confirmar } = useFeedback();
  const { data, error, loading, recargar } = useCarga(async () => {
    const [ventas, cortes, usuarios] = await Promise.all([pos.get<Venta[]>('/api/sales'), pos.get<CorteReg[]>('/api/cash-closings'), admin.get<Usuario[]>('/usuarios').catch(() => [] as Usuario[])]);
    return { ventas, cortes, usuarios };
  });
  const [fondo, setFondo] = useState(() => localStorage.getItem(FONDO_KEY) ?? '');
  const [contado, setContado] = useState('');
  const [guardando, setGuardando] = useState(false);
  const pend = (data?.ventas ?? []).filter((v) => !v.cashClosingId);
  const suma = (m?: string) => r2(pend.filter((v) => !m || v.paymentMethod === m).reduce((a, v) => a + v.total, 0));
  const efectivo = suma('efectivo'), tarjeta = suma('tarjeta'), transf = suma('transferencia'), total = suma();
  const fondoN = Number(fondo || 0), esperado = r2(fondoN + efectivo), contadoN = Number(contado || 0), dif = r2(contadoN - esperado);
  const nombre = (id: string) => { const u = data?.usuarios.find((x) => x.idUsuario === id); return u ? `${u.nombre} ${u.apellidos}` : ''; };

  const cerrar = async () => {
    if (!pend.length && !fondoN) { toast('Nada que cortar', 'No hay ventas pendientes ni fondo inicial.', 'error'); return; }
    if (contado === '') { toast('Falta el conteo', 'Escribe el efectivo que contaste en caja.', 'error'); return; }
    const ok = await confirmar({
      t: '¿Cerrar el turno?', tono: dif === 0 ? 'ok' : 'warn', icon: 'corte', y: 'Sí, hacer corte', n: 'Revisar',
      p: <>Se incluyen {pend.length} ventas por {money(total)}. {dif === 0 ? 'La caja cuadra.' : dif > 0 ? <>Hay un <b>sobrante de {money(dif)}</b>.</> : <>Hay un <b>faltante de {money(-dif)}</b>.</>}</>,
    });
    if (!ok) return;
    setGuardando(true);
    try {
      const r = await pos.post<{ cashClosing: CorteReg }>('/api/cash-closings', {
        salesCount: pend.length, totalSales: total, cashSales: efectivo, cardSales: tarjeta, transferSales: transf,
        initialFund: fondoN, expectedCash: esperado, countedCash: contadoN, difference: dif, registeredBy: yo.idUsuario, saleIds: pend.map((v) => v.id),
      });
      localStorage.removeItem(FONDO_KEY); setFondo(''); setContado('');
      toast('Corte registrado', `${r.cashClosing.folio} · ${money(r.cashClosing.totalSales)} en ventas.`);
      void recargar(true);
    } catch (e) { toast('No se pudo hacer el corte', mensajeError(e), 'error'); }
    finally { setGuardando(false); }
  };

  const cortes = data?.cortes ?? [];
  return (
    <>
      <Kpis items={[
        { label: 'Ventas pendientes de corte', value: pend.length, tono: 'blue', icon: 'venta' },
        { label: 'Total vendido en el turno', value: money(total), tono: 'accent', icon: 'dinero' },
        { label: 'Efectivo', value: money(efectivo), tono: 'ok', icon: 'dinero' },
        { label: 'Tarjeta', value: money(tarjeta), tono: 'purple', icon: 'tarjeta' },
        { label: 'Transferencia', value: money(transf), tono: 'gray', icon: 'transferencia' },
      ]} />
      {error && <ErrorBox mensaje={error} onRetry={recargar} />}
      <div className="nu-desk">
        <section className="dc">
          <div className="dsech"><h3 className="dih"><span className="si"><Icon n="corte" /></span>Cierre del turno</h3><span className="dcount">{pend.length} ventas</span></div>
          <p className="shint" style={{ margin: '0 0 14px' }}>La caja es compartida: el corte incluye todas las ventas que aún no tienen corte.</p>
          <div className="frow2">
            <Field label="Fondo inicial"><div className="money big"><span>$</span><input inputMode="decimal" placeholder="0" value={fondo} onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ''); setFondo(v); localStorage.setItem(FONDO_KEY, v); }} /></div></Field>
            <Field label="Efectivo contado" req><div className="money big"><span>$</span><input inputMode="decimal" placeholder="0" value={contado} onChange={(e) => setContado(e.target.value.replace(/[^\d.]/g, ''))} /></div></Field>
          </div>
          <div className="nu-tot" style={{ marginTop: 4 }}>
            <div><span>Fondo inicial</span><b>{money(fondoN)}</b></div>
            <div><span>Ventas en efectivo</span><b>{money(efectivo)}</b></div>
            <div className="big"><span>Efectivo esperado</span><b>{money(esperado)}</b></div>
            <div><span>Diferencia</span><b style={{ color: contado === '' ? 'var(--ink3)' : dif === 0 ? 'var(--ok)' : dif > 0 ? 'var(--warn)' : 'var(--bad)' }}>{contado === '' ? '—' : `${dif > 0 ? '+' : dif < 0 ? '−' : ''}${money(Math.abs(dif))}`}</b></div>
          </div>
          <button className="btn acc wide" style={{ marginTop: 16 }} disabled={guardando} onClick={cerrar}>{guardando ? <span className="nu-spin" /> : <Icon n="check" w={2.4} />}Hacer corte de caja</button>
        </section>
        <section className="dc">
          <div className="dsech"><h3 className="dih"><span className="si"><Icon n="venta" /></span>Ventas del turno</h3></div>
          <div className="nu-cartl" style={{ maxHeight: 360 }}>
            {loading ? <Cargando /> : pend.length ? [...pend].reverse().map((v) => (
              <div className="tpi" key={v.id}><span className="rk" style={{ color: 'var(--ink3)' }}><Icon n={v.paymentMethod === 'efectivo' ? 'dinero' : v.paymentMethod === 'tarjeta' ? 'tarjeta' : 'transferencia'} /></span>
                <div><b className="mono" style={{ fontSize: 13 }}>{v.folio}</b><small>{v.time} · {v.items.map((i) => `${i.qty} ${i.name}`).join(', ')}</small></div><div className="qn">{money(v.total)}<small style={{ textTransform: 'capitalize' }}>{v.paymentMethod}</small></div></div>
            )) : <div className="dempty">No hay ventas pendientes de corte.</div>}
          </div>
        </section>
      </div>
      <SecHead title="Historial de cortes" />
      <table>
        <thead><tr><th>Corte</th><th>Fecha</th><th className="r">Ventas</th><th className="r">Total</th><th className="r">Efectivo esperado</th><th className="r">Contado</th><th className="r">Diferencia</th><th>Registró</th></tr></thead>
        <tbody>
          {loading ? <Cargando cols={8} /> : cortes.length ? cortes.map((c) => {
            const u = nombre(c.registeredBy);
            return (
              <tr className="r" key={c.id ?? c.folio}>
                <td className="mono">{c.folio}</td>
                <td className="dt"><b>{fechaCorta(deDMY(c.date))}</b><small>{c.time}</small></td>
                <td className="num">{c.salesCount}</td>
                <td className="num">{money(c.totalSales)}</td>
                <td className="num">{money(c.expectedCash)}</td>
                <td className="num">{money(c.countedCash)}</td>
                <td className="num" style={{ color: c.difference === 0 ? 'var(--ok)' : c.difference > 0 ? 'var(--warn)' : 'var(--bad)', fontWeight: 700 }}>{c.difference === 0 ? 'Cuadra' : `${c.difference > 0 ? '+' : '−'}${money(Math.abs(c.difference))}`}</td>
                <td><div className="huser">{u ? <><span className="av">{iniciales(u)}</span>{u}</> : <span className="none">—</span>}</div></td>
              </tr>
            );
          }) : <EmptyRow cols={8} title="Sin cortes" text="Aquí verás cada cierre de turno con su fondo, efectivo esperado y diferencia." />}
        </tbody>
      </table>
    </>
  );
}
