import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin, mensajeError } from '../lib/api';
import { fechaRelativa, horaDe, money, norm, plural } from '../lib/format';
import { useSesion } from '../shell/AppShell';
import { Icon } from '../ui/Icon';
import { Cargando, Drawer, DrawerFooter, EmptyRow, ErrorBox, EstatusSeg, Field, IB, Kpis, PillEstatus, Search, SecHead, Switch, Tabs, useCarga, useFeedback } from '../ui/kit';

export interface Producto { idProducto: string; codigo: string; nombre: string; descripcion: string; categoria: string; precio: number; costo: number; stock: number; stockMinimo: number; estatus: 'activo' | 'inactivo' }
export interface Movimiento { id: string; idProducto: string | null; nombreProducto: string; categoria: string; tipo: 'entrada' | 'salida' | 'merma'; origen: 'movimiento' | 'venta' | 'merma'; cantidad: number; fechaHora: string; motivo: string; precioUnitario: number | null; registro: string }

export const CATEGORIAS = ['Suplementos', 'Accesorios', 'Ropa', 'Equipamiento'];
export const tipoMov = (m: Movimiento): 'in' | 'sale' | 'loss' => (m.tipo === 'entrada' ? 'in' : m.tipo === 'merma' ? 'loss' : 'sale');
const MOTIVOS_MERMA: Record<string, string> = { damaged: 'Producto dañado', expired: 'Producto caducado', broken: 'Producto roto', 'internal-use': 'Uso interno', 'inventory-error': 'Error de inventario', lost: 'Extravío', other: 'Otro' };
export const conceptoMov = (m: Movimiento) => {
  const [base, ...resto] = m.motivo.split(' · ');
  return [MOTIVOS_MERMA[base] ?? base, ...resto].filter(Boolean).join(' · ') || (m.tipo === 'entrada' ? 'Entrada' : 'Salida');
};
const stkState = (p: Producto) => (p.stock === 0 ? 'zero' : p.stock <= p.stockMinimo ? 'low' : 'ok');

/** Panel "Registrar movimiento" (entrada, venta o merma/ajuste), compartido con Movimientos. */
export function MovimientoDrawer({ open, onClose, productos, idInicial, onHecho }: { open: boolean; onClose: () => void; productos: Producto[]; idInicial?: string; onHecho: (p: Producto) => void }) {
  const { toast } = useFeedback();
  const [pid, setPid] = useState(idInicial ?? '');
  const [tipo, setTipo] = useState<'in' | 'sale' | 'loss'>('in');
  const [qty, setQty] = useState('');
  const [nota, setNota] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [abiertoAntes, setAbiertoAntes] = useState(false);
  if (open && !abiertoAntes) { setAbiertoAntes(true); setPid(idInicial ?? ''); setTipo('in'); setQty(''); setNota(''); setErrs({}); }
  if (!open && abiertoAntes) setAbiertoAntes(false);
  const p = productos.find((x) => x.idProducto === pid);
  const q = Number(qty || 0);
  const despues = p ? (tipo === 'in' ? p.stock + q : p.stock - q) : 0;
  const guardar = async () => {
    const e: Record<string, string> = {};
    if (!p) e.prod = 'Elige un producto.';
    if (!q) e.qty = 'Escribe una cantidad mayor a 0.';
    else if (p && tipo !== 'in' && q > p.stock) e.qty = `Solo hay ${plural(p.stock, 'unidad', 'unidades')} en stock.`;
    if (tipo === 'loss' && !nota.trim()) e.nota = 'Explica el motivo del ajuste.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setGuardando(true);
    try {
      const r = await admin.post<{ producto: Producto }>('/movimientos', {
        idProducto: p!.idProducto, tipo: tipo === 'in' ? 'entrada' : tipo === 'sale' ? 'salida' : 'merma', cantidad: q,
        motivo: nota.trim() || (tipo === 'in' ? 'Compra a proveedor' : tipo === 'sale' ? 'Venta en punto de venta' : ''),
      });
      onHecho(r.producto);
      toast('Movimiento registrado', `${p!.nombre}: ${tipo === 'in' ? '+' : '−'}${q}. Ahora hay ${r.producto.stock} en stock.`);
      onClose();
    } catch (err) { toast('No se pudo registrar', mensajeError(err), 'error'); }
    finally { setGuardando(false); }
  };
  return (
    <Drawer open={open} onClose={onClose} onSubmit={guardar} title="Registrar movimiento" sub="Entradas de proveedor, ventas o ajustes de inventario."
      footer={<DrawerFooter label="Registrar movimiento" onSave={guardar} onCancel={onClose} saving={guardando} />}>
      <div className="lbl">Producto</div>
      <div className="sbox">
        <Field label="Producto" req last error={errs.prod} hint={p ? `Stock actual: ${plural(p.stock, 'unidad', 'unidades')}` : undefined}>
          <select className="sel" value={pid} onChange={(e) => { setPid(e.target.value); setErrs({}); }}>
            <option value="">Elige un producto</option>
            {[...productos].sort((a, b) => (a.estatus === b.estatus ? a.nombre.localeCompare(b.nombre, 'es') : a.estatus === 'activo' ? -1 : 1)).map((x) => (
              <option key={x.idProducto} value={x.idProducto}>{x.nombre}{x.estatus === 'activo' ? '' : ' (inactivo)'}</option>))}
          </select>
        </Field>
      </div>
      <div className="lbl">Tipo de movimiento</div>
      <div className="sbox">
        <div className="mtypes">
          {([['in', '↑', 'Entrada', 'Compra a proveedor o devolución'], ['sale', '↓', 'Venta', 'Salida por venta en punto de venta'], ['loss', '↓', 'Merma o ajuste', 'Producto dañado, caducado o conteo']] as const).map(([k, a, b, s]) => (
            <button type="button" key={k} className={tipo === k ? 'on' : ''} onClick={() => { setTipo(k); setErrs({}); }}><span className={`mti ${k}`}>{a}</span><b>{b}</b><small>{s}</small></button>))}
        </div>
        <div style={{ height: 14 }} />
      </div>
      <div className="lbl">Detalle</div>
      <div className="sbox">
        <Field label="Cantidad" req error={errs.qty}><div className="unitw"><input inputMode="numeric" placeholder="0" value={qty} onChange={(e) => { setQty(e.target.value.replace(/\D/g, '').slice(0, 5)); setErrs({}); }} /><span>unidades</span></div></Field>
        <Field label={tipo === 'loss' ? 'Motivo del ajuste' : 'Concepto'} req={tipo === 'loss'} opt={tipo !== 'loss'} last error={errs.nota}>
          <input value={nota} onChange={(e) => { setNota(e.target.value); setErrs({}); }} placeholder={tipo === 'in' ? 'Ej. Compra a proveedor Optimum Nutrition' : tipo === 'sale' ? 'Ej. Venta en punto de venta' : 'Ej. Empaque roto, producto caducado, conteo físico'} />
        </Field>
      </div>
      {p && q > 0 && (
        <div className={`vprev ${despues < 0 ? 'bad' : despues <= p.stockMinimo ? 'low' : ''}`}>
          <span>{despues < 0 ? 'No hay suficientes unidades' : 'Stock después del movimiento'}</span>
          <span><b>{p.stock}</b><span className="arrow">→</span><b className="after">{despues}</b></span>
        </div>
      )}
    </Drawer>
  );
}

export function MovRow({ m }: { m: Movimiento }) {
  const t = tipoMov(m), inn = t === 'in';
  return (
    <div className="mvrow"><span className={`mti ${t}`}>{inn ? '↑' : '↓'}</span>
      <div className="mvt"><b>{m.nombreProducto}</b><small>{!inn && <span className={`mvk ${t}`}>{t === 'sale' ? 'Venta' : 'Merma'}</span>}{conceptoMov(m)}{m.registro ? ` · ${m.registro}` : ''}</small></div>
      <div className={`mvq ${inn ? 'qin' : 'qout'}`}>{inn ? '+' : '−'}{m.cantidad}</div>
      <div className="mvd"><b>{fechaRelativa(m.fechaHora)}</b><small>{horaDe(m.fechaHora)}</small></div></div>
  );
}

export default function Inventario() {
  const yo = useSesion();
  const nav = useNavigate();
  const editable = yo.rol !== 'recepcion'; // recepción consulta el inventario compartido
  const { toast, confirmar } = useFeedback();
  const { data, setData, error, loading, recargar } = useCarga(async () => {
    const [productos, movs] = await Promise.all([admin.get<Producto[]>('/productos'), admin.get<Movimiento[]>('/movimientos?limit=60').catch(() => [] as Movimiento[])]);
    return { productos, movs };
  });
  const P = data?.productos ?? [];
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [inactivos, setInactivos] = useState(true);
  const [pd, setPd] = useState<{ open: boolean; edit?: Producto }>({ open: false });
  const [f, setF] = useState({ nombre: '', desc: '', cat: CATEGORIAS[0], precio: '', stock: '', min: '5', activo: true });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [mov, setMov] = useState<{ open: boolean; id?: string }>({ open: false });

  const cats = [...new Set([...CATEGORIAS, ...P.map((p) => p.categoria).filter(Boolean)])];
  const on = P.filter((p) => p.estatus === 'activo');
  const lista = useMemo(() => P
    .filter((p) => (inactivos || p.estatus === 'activo') && (cat === 'all' || p.categoria === cat || (cat === 'low' && stkState(p) !== 'ok')) && (!q || norm(`${p.nombre} ${p.descripcion}`).includes(norm(q))))
    .sort((a, b) => (a.estatus === b.estatus ? a.nombre.localeCompare(b.nombre, 'es') : a.estatus === 'activo' ? -1 : 1)), [P, q, cat, inactivos]);

  const abrir = (p?: Producto) => {
    setF(p ? { nombre: p.nombre, desc: p.descripcion, cat: p.categoria, precio: String(p.precio), stock: String(p.stock), min: String(p.stockMinimo), activo: p.estatus === 'activo' } : { nombre: '', desc: '', cat: CATEGORIAS[0], precio: '', stock: '', min: '5', activo: true });
    setErrs({}); setPd({ open: true, edit: p });
  };
  const guardar = async () => {
    const e: Record<string, string> = {}, pre = parseFloat(f.precio);
    if (!f.nombre.trim()) e.nombre = 'Escribe el nombre.';
    else if (P.some((p) => norm(p.nombre) === norm(f.nombre) && p.idProducto !== pd.edit?.idProducto)) e.nombre = 'Ya existe un producto con este nombre.';
    if (!(pre > 0)) e.precio = 'Escribe un precio mayor a $0.';
    setErrs(e);
    if (Object.keys(e).length) return;
    const cuerpo = { nombre: f.nombre.trim(), descripcion: f.desc.trim(), categoria: f.cat, precio: pre, stockMinimo: Number(f.min || 0), estatus: f.activo ? 'activo' : 'inactivo' };
    setGuardando(true);
    try {
      if (pd.edit) {
        const r = await admin.patch<Producto>(`/productos/${pd.edit.idProducto}`, cuerpo);
        setData((d) => d && { ...d, productos: d.productos.map((x) => (x.idProducto === r.idProducto ? r : x)) });
        toast('Cambios guardados', `Actualizamos ${r.nombre}.`);
      } else {
        const r = await admin.post<Producto>('/productos', { ...cuerpo, stock: Number(f.stock || 0) });
        setData((d) => d && { ...d, productos: [...d.productos, r] });
        toast('Producto agregado', `${r.nombre} ya está en el inventario.`);
        void recargar(true);
      }
      setPd({ open: false });
    } catch (err) { toast('No se pudo guardar', mensajeError(err), 'error'); }
    finally { setGuardando(false); }
  };
  const alternar = async (p: Producto) => {
    const activar = p.estatus !== 'activo';
    const ok = await confirmar(activar ? { t: `¿Reactivar ${p.nombre}?`, p: 'Volverá a aparecer a la venta en punto de venta.', y: 'Sí, reactivar', tono: 'ok' }
      : { t: `¿Desactivar ${p.nombre}?`, p: 'Dejará de aparecer a la venta en punto de venta. Su stock y su historial se conservan.', y: 'Sí, desactivar', n: 'No, mantener activo' });
    if (!ok) return;
    try {
      const r = await admin.patch<Producto>(`/productos/${p.idProducto}`, { estatus: activar ? 'activo' : 'inactivo' });
      setData((d) => d && { ...d, productos: d.productos.map((x) => (x.idProducto === r.idProducto ? r : x)) });
      toast(activar ? 'Producto reactivado' : 'Producto desactivado', activar ? `${p.nombre} ya está a la venta.` : `${p.nombre} ya no aparece a la venta.`);
    } catch (err) { toast('No se pudo actualizar', mensajeError(err), 'error'); }
  };

  const movs = data?.movs ?? [];
  const salidas = movs.filter((m) => m.tipo !== 'entrada'), entradas = movs.filter((m) => m.tipo === 'entrada');
  return (
    <>
      <Kpis items={[
        { label: 'Productos activos', value: on.length, tono: 'ok', icon: 'inventario' },
        { label: 'Productos inactivos', value: P.length - on.length, tono: 'bad', icon: 'off' },
        { label: 'Unidades en stock', value: on.reduce((a, p) => a + p.stock, 0).toLocaleString('es-MX'), tono: 'blue', icon: 'cuadros' },
        { label: 'Valor del inventario', value: money(on.reduce((a, p) => a + p.stock * p.precio, 0)), tono: 'accent', icon: 'dinero' },
        { label: 'Con stock bajo o agotado', value: on.filter((p) => stkState(p) !== 'ok').length, tono: 'warn', icon: 'alerta' },
      ]} />
      <SecHead title="Productos"><Search value={q} onChange={setQ} placeholder="Buscar producto o descripción" /></SecHead>
      <div className="tabrow">
        <Tabs value={cat} onChange={setCat} tabs={[['all', 'Todos', P.length], ...cats.map((c) => [c, c, P.filter((p) => p.categoria === c).length] as [string, string, number]), ['low', 'Stock bajo', P.filter((p) => stkState(p) !== 'ok').length]]} />
        <Switch checked={inactivos} onChange={setInactivos} label="Mostrar inactivos" />
        {editable && <button className="btn acc" style={{ marginLeft: 'auto' }} onClick={() => abrir()}><Icon n="mas" w={2.4} />Nuevo producto</button>}
      </div>
      {error && <ErrorBox mensaje={error} onRetry={recargar} />}
      <table>
        <thead><tr><th>Producto</th><th>Categoría</th><th className="r">Precio</th><th>Stock</th><th className="r">Valor en stock</th><th>Estatus</th>{editable && <th className="r">Acciones</th>}</tr></thead>
        <tbody>
          {loading ? <Cargando cols={7} /> : lista.length ? lista.map((p) => {
            const st = stkState(p);
            return (
              <tr key={p.idProducto} className={`r ${p.estatus === 'activo' ? '' : 'inact'}`}>
                <td><div className="who"><div><b>{p.nombre}</b><span className="pdesc" title={p.descripcion}>{p.descripcion || 'Sin descripción'}</span></div></div></td>
                <td className="fade">{p.categoria}</td>
                <td className="fade num">{money(p.precio)}</td>
                <td className="fade"><div className="stk"><b>{p.stock}</b>{st === 'zero' ? <span className="pill s-zero">Agotado</span> : st === 'low' ? <span className="pill s-low">Stock bajo</span> : null}</div></td>
                <td className="fade num">{money(p.stock * p.precio)}</td>
                <td><PillEstatus activo={p.estatus === 'activo'} /></td>
                {editable && <td><div className="acts">
                  <IB icon="movimientos" kind="mv" tip="Registrar movimiento" label={`Registrar movimiento de ${p.nombre}`} onClick={() => setMov({ open: true, id: p.idProducto })} />
                  <IB icon="editar" tip="Editar" label={`Editar ${p.nombre}`} onClick={() => abrir(p)} />
                  {p.estatus === 'activo' ? <IB icon="off" kind="off" tip="Desactivar" onClick={() => alternar(p)} /> : <IB icon="on" kind="on" tip="Reactivar" onClick={() => alternar(p)} />}
                </div></td>}
              </tr>
            );
          }) : <EmptyRow cols={7} title="No encontramos productos" text="Prueba con otro nombre o categoría." />}
        </tbody>
      </table>
      <div className="movs">
        <div className="movh"><h2 className="sech">Movimientos</h2><span style={{ marginLeft: 'auto' }} />
          <button className="btn ghost2" onClick={() => nav('/movimientos')}>Ver historial completo</button>
          {editable && <button className="btn glass" onClick={() => setMov({ open: true })}><Icon n="movimientos" />Registrar movimiento</button>}</div>
        <div className="mvcols">
          <div className="mvcol"><div className="mvch"><span className="mti sale">↓</span><h3>Salidas recientes</h3><em>{salidas.length}</em></div>
            {salidas.length ? salidas.slice(0, 8).map((m) => <MovRow key={m.id} m={m} />) : <div className="mvempty"><b>Sin salidas</b><span>Aquí verás las ventas y mermas.</span></div>}</div>
          <div className="mvcol"><div className="mvch"><span className="mti in">↑</span><h3>Entradas recientes</h3><em>{entradas.length}</em></div>
            {entradas.length ? entradas.slice(0, 8).map((m) => <MovRow key={m.id} m={m} />) : <div className="mvempty"><b>Sin entradas</b><span>Aquí verás las compras a proveedor.</span></div>}</div>
        </div>
      </div>

      <Drawer open={pd.open} onClose={() => setPd({ open: false })} onSubmit={guardar} title={pd.edit ? 'Editar producto' : 'Nuevo producto'} sub={pd.edit ? pd.edit.nombre : 'Agrega un artículo a la venta en punto de venta.'}
        footer={<DrawerFooter label={pd.edit ? 'Guardar cambios' : 'Agregar producto'} onSave={guardar} onCancel={() => setPd({ open: false })} saving={guardando} />}>
        <div className="lbl">Datos del producto</div>
        <div className="sbox">
          <Field label="Nombre del producto" req error={errs.nombre}><input placeholder="Ej. Proteína Whey Gold" value={f.nombre} onChange={(e) => { setF({ ...f, nombre: e.target.value }); setErrs({}); }} /></Field>
          <Field label="Descripción" opt><textarea rows={2} placeholder="Ej. Proteína de suero 2.27 kg sabor chocolate" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></Field>
          <Field label="Categoría" req last><div className="catpick">{cats.map((c) => <button type="button" key={c} className={f.cat === c ? 'on' : ''} onClick={() => setF({ ...f, cat: c })}>{c}</button>)}</div></Field>
        </div>
        <div className="lbl">Precio y stock</div>
        <div className="sbox">
          <Field label="Precio de venta" req error={errs.precio}><div className="money big"><span>$</span><input inputMode="decimal" placeholder="0" value={f.precio} onChange={(e) => { setF({ ...f, precio: e.target.value.replace(/[^\d.]/g, '').slice(0, 8) }); setErrs({}); }} /></div></Field>
          <Field label={pd.edit ? 'Stock actual' : 'Stock inicial'} hint={pd.edit ? 'Para cambiarlo usa “Registrar movimiento”, así queda el historial.' : 'Unidades con las que empiezas. Se registra como una entrada.'}>
            <input inputMode="numeric" placeholder="0" disabled={!!pd.edit} value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value.replace(/\D/g, '').slice(0, 5) })} /></Field>
          <Field label="Avisar cuando queden" last hint="Te marcamos el producto como “Stock bajo”."><div className="unitw"><input inputMode="numeric" placeholder="5" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value.replace(/\D/g, '').slice(0, 5) })} /><span>unidades o menos</span></div></Field>
        </div>
        <div className="lbl">Estatus</div>
        <div className="sbox stsb"><EstatusSeg activo={f.activo} onChange={(v) => setF({ ...f, activo: v })}
          textoOn={<><b style={{ color: 'var(--ink)' }}>Se puede vender</b> en punto de venta.</>} textoOff={<><b style={{ color: 'var(--ink)' }}>No aparecerá a la venta.</b> Su historial se conserva.</>} /></div>
      </Drawer>
      <MovimientoDrawer open={mov.open} idInicial={mov.id} productos={P} onClose={() => setMov({ open: false })}
        onHecho={(p) => { setData((d) => d && { ...d, productos: d.productos.map((x) => (x.idProducto === p.idProducto ? p : x)) }); void recargar(true); }} />
    </>
  );
}
