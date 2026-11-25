import { useMemo, useState } from 'react';
import { admin, mensajeError, pos } from '../lib/api';
import { fechaRelativa, horaDe, iniciales, money, norm, plural } from '../lib/format';
import type { Usuario } from '../lib/session';
import { useSesion } from '../shell/AppShell';
import { Icon } from '../ui/Icon';
import { Cargando, Drawer, DrawerFooter, EmptyRow, ErrorBox, Field, Kpis, Periodo, Search, SecHead, Tabs, useCarga, useFeedback } from '../ui/kit';
import type { ProductoPos } from './Venta';

interface MermaReg { id: number; folio: string; productId: number; quantity: number; reason: string; observations: string; createdAt: string; registeredBy: string }
export const MOTIVOS: [string, string][] = [['damaged', 'Producto dañado'], ['expired', 'Producto caducado'], ['broken', 'Producto roto'], ['internal-use', 'Uso interno'], ['inventory-error', 'Error de inventario'], ['lost', 'Extravío'], ['other', 'Otro']];
const motivo = (k: string) => MOTIVOS.find(([x]) => x === k)?.[1] ?? k;

export default function Merma() {
  const yo = useSesion();
  const { toast } = useFeedback();
  const { data, setData, error, loading, recargar } = useCarga(async () => {
    const [mermas, productos, usuarios] = await Promise.all([
      pos.get<MermaReg[]>('/api/waste'), pos.get<ProductoPos[]>('/api/products'), admin.get<Usuario[]>('/usuarios').catch(() => [] as Usuario[]),
    ]);
    return { mermas, productos, usuarios };
  });
  const [q, setQ] = useState('');
  const [per, setPer] = useState<'today' | '7' | 'month' | 'all'>('month');
  const [tab, setTab] = useState('all');
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({ pid: '', qty: '', reason: 'damaged', obs: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const P = data?.productos ?? [];
  const nombreUsuario = (id: string) => { const u = data?.usuarios.find((x) => x.idUsuario === id); return u ? `${u.nombre} ${u.apellidos}` : id && !/^[a-f\d]{24}$/i.test(id) ? id : ''; };
  const prod = (id: number) => P.find((p) => p.id === id);
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const enRango = (d: Date) => per === 'today' ? d >= t0 : per === '7' ? d >= new Date(t0.getTime() - 6 * 864e5) : per === 'month' ? d >= new Date(t0.getFullYear(), t0.getMonth(), 1) : true;
  const R = (data?.mermas ?? []).filter((m) => enRango(new Date(m.createdAt)));
  const Q = R.filter((m) => !q || norm(`${prod(m.productId)?.name} ${m.folio} ${m.observations} ${motivo(m.reason)}`).includes(norm(q)));
  const L = useMemo(() => Q.filter((m) => tab === 'all' || m.reason === tab).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [Q, tab]);
  const costo = (m: MermaReg) => m.quantity * (prod(m.productId)?.cost ?? 0);

  const p = P.find((x) => String(x.id) === f.pid);
  const guardar = async () => {
    const e: Record<string, string> = {}, n = Number(f.qty || 0);
    if (!p) e.pid = 'Elige un producto.';
    if (!n) e.qty = 'Escribe una cantidad mayor a 0.';
    else if (p && n > p.stock) e.qty = `Solo hay ${plural(p.stock, 'unidad', 'unidades')} en stock.`;
    if (f.reason === 'other' && !f.obs.trim()) e.obs = 'Explica el motivo.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setGuardando(true);
    try {
      const r = await pos.post<{ wasteRecord: MermaReg }>('/api/waste', { productId: p!.id, quantity: n, reason: f.reason, observations: f.obs.trim(), registeredBy: yo.idUsuario });
      setData((d) => d && { ...d, mermas: [r.wasteRecord, ...d.mermas], productos: d.productos.map((x) => (x.id === p!.id ? { ...x, stock: x.stock - n } : x)) });
      toast('Merma registrada', `${r.wasteRecord.folio} · ${p!.name}: −${n}. Ahora hay ${p!.stock - n} en stock.`);
      setAbierto(false);
    } catch (err) { toast('No se pudo registrar', mensajeError(err), 'error'); }
    finally { setGuardando(false); }
  };

  return (
    <>
      <Kpis items={[
        { label: 'Mermas en el periodo', value: R.length, tono: 'bad', icon: 'merma' },
        { label: 'Unidades perdidas', value: R.reduce((a, m) => a + m.quantity, 0), tono: 'warn', icon: 'flechaAbajo' },
        { label: 'Costo de la merma', value: money(R.reduce((a, m) => a + costo(m), 0)), tono: 'accent', icon: 'dinero' },
        { label: 'Productos afectados', value: new Set(R.map((m) => m.productId)).size, tono: 'purple', icon: 'inventario' },
        { label: 'Por caducidad', value: R.filter((m) => m.reason === 'expired').length, tono: 'gray', icon: 'reloj' },
      ]} />
      <SecHead title="Registro de mermas">
        <Search value={q} onChange={setQ} placeholder="Buscar producto, folio o motivo" />
        <Periodo style={{ marginLeft: 'auto', borderLeft: 'none' }} value={per} onChange={setPer} opciones={[['today', 'Hoy'], ['7', '7 días'], ['month', 'Este mes'], ['all', 'Todo']]} />
      </SecHead>
      <div className="tabrow">
        <Tabs value={tab} onChange={setTab} tabs={[['all', 'Todas', Q.length], ...MOTIVOS.filter(([k]) => Q.some((m) => m.reason === k)).map(([k, l]) => [k, l, Q.filter((m) => m.reason === k).length] as [string, string, number])]} />
        <button className="btn acc" style={{ marginLeft: 'auto' }} onClick={() => { setF({ pid: '', qty: '', reason: 'damaged', obs: '' }); setErrs({}); setAbierto(true); }}><Icon n="mas" w={2.4} />Registrar merma</button>
      </div>
      {error && <ErrorBox mensaje={error} onRetry={recargar} />}
      <table className="htab">
        <thead><tr><th>Fecha</th><th>Folio</th><th>Producto</th><th>Motivo</th><th className="r">Cantidad</th><th className="r">Costo</th><th>Registró</th></tr></thead>
        <tbody>
          {loading ? <Cargando cols={7} /> : L.length ? L.map((m) => {
            const pr = prod(m.productId), u = nombreUsuario(m.registeredBy);
            return (
              <tr className="r" key={m.id}>
                <td><div className="hdate"><b>{fechaRelativa(m.createdAt)}</b><small>{horaDe(m.createdAt)}</small></div></td>
                <td className="mono fade">{m.folio}</td>
                <td><div className="hprod"><b>{pr?.name ?? 'Producto'}</b><small>{pr?.category}</small></div></td>
                <td className="hcon" title={m.observations}><span className="pill t-loss">{motivo(m.reason)}</span>{m.observations && <small style={{ display: 'block', color: 'var(--ink3)', marginTop: 3 }}>{m.observations}</small>}</td>
                <td className="hqty qout">−{m.quantity}</td>
                <td className="num">{money(costo(m))}</td>
                <td><div className="huser">{u ? <><span className="av">{iniciales(u)}</span>{u}</> : <span className="none">Sin registro</span>}</div></td>
              </tr>
            );
          }) : <EmptyRow cols={7} title="Sin mermas" text="No hay mermas con estos filtros en el periodo elegido." />}
        </tbody>
      </table>

      <Drawer open={abierto} onClose={() => setAbierto(false)} onSubmit={guardar} title="Registrar merma" sub="Producto dañado, caducado, roto o ajuste de conteo."
        footer={<DrawerFooter label="Registrar merma" onSave={guardar} onCancel={() => setAbierto(false)} saving={guardando} />}>
        <div className="lbl">Producto</div>
        <div className="sbox">
          <Field label="Producto" req last error={errs.pid} hint={p ? `Stock actual: ${plural(p.stock, 'unidad', 'unidades')}` : undefined}>
            <select className="sel" value={f.pid} onChange={(e) => { setF({ ...f, pid: e.target.value }); setErrs({}); }}>
              <option value="">Elige un producto</option>
              {[...P].sort((a, b) => a.name.localeCompare(b.name, 'es')).map((x) => <option key={x.id} value={x.id}>{x.name}{x.status === 'active' ? '' : ' (inactivo)'}</option>)}
            </select>
          </Field>
        </div>
        <div className="lbl">Motivo</div>
        <div className="sbox"><div className="catpick" style={{ marginBottom: 14 }}>{MOTIVOS.map(([k, l]) => <button type="button" key={k} className={f.reason === k ? 'on' : ''} onClick={() => setF({ ...f, reason: k })}>{l}</button>)}</div></div>
        <div className="lbl">Detalle</div>
        <div className="sbox">
          <Field label="Cantidad" req error={errs.qty}><div className="unitw"><input inputMode="numeric" placeholder="0" value={f.qty} onChange={(e) => { setF({ ...f, qty: e.target.value.replace(/\D/g, '').slice(0, 5) }); setErrs({}); }} /><span>unidades</span></div></Field>
          <Field label="Observaciones" req={f.reason === 'other'} opt={f.reason !== 'other'} last error={errs.obs}><textarea rows={2} placeholder="Ej. Empaque roto al recibir del proveedor" value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></Field>
        </div>
        {p && Number(f.qty) > 0 && <div className={`vprev ${p.stock - Number(f.qty) < 0 ? 'bad' : 'low'}`}><span>Stock después de la merma</span><span><b>{p.stock}</b><span className="arrow">→</span><b className="after">{p.stock - Number(f.qty)}</b></span></div>}
      </Drawer>
    </>
  );
}
