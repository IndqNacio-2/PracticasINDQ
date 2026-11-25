import { useMemo, useState } from 'react';
import { mensajeError, pos } from '../lib/api';
import { hoyDMY, money, norm } from '../lib/format';
import { useSesion } from '../shell/AppShell';
import { Icon } from '../ui/Icon';
import { CobroDrawer, TicketDialog, type Ticket } from '../ui/Cobro';
import { Cargando, ErrorBox, Kpis, Search, SecHead, Tabs, useCarga, useFeedback } from '../ui/kit';

export interface ProductoPos { id: number; code: string; name: string; description: string; category: string; price: number; cost: number; stock: number; minimumStock: number; status: 'active' | 'inactive' }
export interface Venta {
  id: number; folio: string; date: string; time: string; sellerId: string | null; cashClosingId: number | null;
  items: { name: string; qty: number; unitPrice: number; subtotal: number }[]; subtotal: number; discount: number; total: number;
  paymentMethod: 'efectivo' | 'tarjeta' | 'transferencia'; cashReceived?: number; change?: number; transferRef?: string;
}

export default function VentaPage() {
  const yo = useSesion();
  const { toast } = useFeedback();
  const { data, setData, error, loading, recargar } = useCarga(async () => {
    const [productos, ventas] = await Promise.all([pos.get<ProductoPos[]>('/api/products'), pos.get<Venta[]>('/api/sales').catch(() => [] as Venta[])]);
    return { productos, ventas };
  });
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [carrito, setCarrito] = useState<Record<number, number>>({});
  const [desc, setDesc] = useState('');
  const [cobrar, setCobrar] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const P = (data?.productos ?? []).filter((p) => p.status === 'active');
  const cats = [...new Set(P.map((p) => p.category))].sort();
  const lista = useMemo(() => P.filter((p) => (cat === 'all' || p.category === cat) && (!q || norm(`${p.name} ${p.description} ${p.code}`).includes(norm(q)))).sort((a, b) => a.name.localeCompare(b.name, 'es')), [P, q, cat]);
  const items = Object.entries(carrito).map(([id, n]) => ({ p: (data?.productos ?? []).find((x) => x.id === Number(id))!, n })).filter((x) => x.p);
  const subtotal = items.reduce((a, x) => a + x.n * x.p.price, 0);
  const descuento = Math.min(subtotal, Number(desc || 0));
  const total = Math.max(0, subtotal - descuento);
  const hoyV = (data?.ventas ?? []).filter((v) => v.date === hoyDMY());

  const agregar = (p: ProductoPos, d = 1) => setCarrito((c) => {
    const n = Math.max(0, Math.min(p.stock, (c[p.id] ?? 0) + d));
    if ((c[p.id] ?? 0) + d > p.stock) toast('Sin más unidades', `Solo hay ${p.stock} de ${p.name} en stock.`, 'error');
    const x = { ...c };
    if (n) x[p.id] = n; else delete x[p.id];
    return x;
  });

  const pagar = async (pg: { metodoPago: string; efectivoRecibido?: number; referencia?: string }) => {
    try {
      const r = await pos.post<{ sale: Venta }>('/api/sales', {
        items: items.map((x) => ({ productId: x.p.id, quantity: x.n })), discount: descuento, paymentMethod: pg.metodoPago,
        ...(pg.metodoPago === 'efectivo' ? { cashReceived: pg.efectivoRecibido } : {}), ...(pg.metodoPago === 'transferencia' && pg.referencia ? { transferRef: pg.referencia } : {}),
      });
      const v = r.sale;
      setTicket({
        folio: v.folio, fecha: new Date().toISOString(), usuario: `${yo.nombre} ${yo.apellidos}`, metodoPago: v.paymentMethod, total: v.total,
        efectivoRecibido: v.cashReceived ?? null, cambio: v.change ?? null, referencia: v.transferRef ?? null,
        items: [...v.items.map((i) => ({ descripcion: i.name, cantidad: i.qty, precioUnitario: i.unitPrice, importe: i.subtotal })), ...(v.discount ? [{ descripcion: 'Descuento', cantidad: 1, precioUnitario: -v.discount, importe: -v.discount }] : [])],
      });
      setCarrito({}); setDesc(''); setCobrar(false);
      setData((d) => d && { ...d, ventas: [...d.ventas, v] });
      toast('Venta registrada', `Folio ${v.folio} · ${money(v.total)}`);
      void recargar(true);
    } catch (e) { toast('No se pudo cobrar', mensajeError(e), 'error'); }
  };

  return (
    <>
      <Kpis items={[
        { label: 'Ventas de hoy', value: money(hoyV.reduce((a, v) => a + v.total, 0)), tono: 'accent', icon: 'venta' },
        { label: 'Tickets de hoy', value: hoyV.length, tono: 'blue', icon: 'imprimir' },
        { label: 'Pendientes de corte', value: (data?.ventas ?? []).filter((v) => !v.cashClosingId).length, tono: 'purple', icon: 'corte' },
        { label: 'Productos a la venta', value: P.length, tono: 'ok', icon: 'inventario' },
        { label: 'Con stock bajo o agotado', value: P.filter((p) => p.stock <= p.minimumStock).length, tono: 'warn', icon: 'alerta' },
      ]} />
      {error && <ErrorBox mensaje={error} onRetry={recargar} />}
      <div className="nu-pos">
        <div>
          <SecHead title="Productos"><Search value={q} onChange={setQ} placeholder="Buscar producto, descripción o código" /></SecHead>
          <div className="tabrow" style={{ marginBottom: 20 }}><Tabs value={cat} onChange={setCat} tabs={[['all', 'Todos', P.length], ...cats.map((c) => [c, c, P.filter((p) => p.category === c).length] as [string, string, number])]} /></div>
          {loading ? <Cargando /> : lista.length ? (
            <div className="nu-pgrid">
              {lista.map((p) => {
                const en = carrito[p.id] ?? 0, agotado = p.stock <= 0;
                return (
                  <button key={p.id} className={`nu-prod ${en ? 'on' : ''}`} disabled={agotado} onClick={() => agregar(p)}>
                    <span className="nu-pcat">{p.category}</span>
                    <b>{p.name}</b>
                    <small title={p.description}>{p.description || 'Sin descripción'}</small>
                    <span className="nu-pfoot"><span className="nu-pprice">{money(p.price)}</span>
                      <span className={`nu-pstk ${agotado ? 'zero' : p.stock <= p.minimumStock ? 'low' : ''}`}>{agotado ? 'Agotado' : `${p.stock} en stock`}</span></span>
                    {en > 0 && <span className="nu-pin">{en}</span>}
                  </button>
                );
              })}
            </div>
          ) : <div className="dempty">No encontramos productos. Prueba con otro nombre o categoría.</div>}
        </div>
        <aside className="dc nu-cart">
          <div className="dsech"><h3 className="dih"><span className="si"><Icon n="venta" /></span>Venta actual</h3><span className="dcount">{items.reduce((a, x) => a + x.n, 0)} artículos</span></div>
          <div className="nu-cartl">
            {items.length ? items.map(({ p, n }) => (
              <div className="nu-ci" key={p.id}>
                <div><b>{p.name}</b><small>{money(p.price)} c/u</small></div>
                <div className="nu-qty"><button type="button" aria-label="Quitar uno" onClick={() => agregar(p, -1)}><Icon n="menos" w={2.4} /></button><span>{n}</span><button type="button" aria-label="Agregar uno" onClick={() => agregar(p, 1)}><Icon n="mas" w={2.4} /></button></div>
                <b className="nu-cimp">{money(n * p.price)}</b>
              </div>
            )) : <div className="dempty">Elige productos para empezar la venta.</div>}
          </div>
          <div className="nu-tot">
            <div><span>Subtotal</span><b>{money(subtotal)}</b></div>
            <div><span>Descuento</span><div className="money" style={{ width: 120 }}><span>$</span><input inputMode="decimal" value={desc} placeholder="0" onChange={(e) => setDesc(e.target.value.replace(/[^\d.]/g, ''))} aria-label="Descuento" /></div></div>
            <div className="big"><span>Total</span><b>{money(total)}</b></div>
          </div>
          <button className="btn acc wide" disabled={!items.length} onClick={() => setCobrar(true)}><Icon n="dinero" />Cobrar {money(total)}</button>
          {items.length > 0 && <button className="btn cancel" style={{ width: '100%' }} onClick={() => { setCarrito({}); setDesc(''); }}>Vaciar venta</button>}
        </aside>
      </div>
      <CobroDrawer open={cobrar} onClose={() => setCobrar(false)} titulo="Cobrar venta" sub="Punto de venta" total={total} onCobrar={pagar}
        resumen={<>{items.map(({ p, n }) => <div className="nu-tkr" key={p.id}><span>{n} × {p.name}</span><b>{money(n * p.price)}</b></div>)}
          {descuento > 0 && <div className="nu-tkr"><span>Descuento</span><b>−{money(descuento)}</b></div>}</>} />
      <TicketDialog ticket={ticket} onClose={() => setTicket(null)} />
    </>
  );
}
