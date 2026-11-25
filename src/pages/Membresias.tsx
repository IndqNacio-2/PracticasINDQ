import { useMemo, useState } from 'react';
import { admin, mensajeError } from '../lib/api';
import { compras as apiCompras, type Compra } from '../lib/datos';
import { claveDia, fechaCorta, hoyClave, iniciales, money, norm, sumarDias, hoy } from '../lib/format';
import { useSesion } from '../shell/AppShell';
import { Icon } from '../ui/Icon';
import { TicketDialog, type Ticket } from '../ui/Cobro';
import { Avatar, Cargando, Drawer, DrawerFooter, EmptyRow, ErrorBox, EstatusSeg, Field, IB, Kpis, PillEstatus, Search, SecHead, Tabs, useCarga, useFeedback } from '../ui/kit';
import { optEntradas, optVigencia, VentaMembresia, type Membresia, type Opcion } from '../ui/VentaMembresia';

interface Clase { idClase: string; nombre: string; descripcion: string; estatus: string; color?: string }
export type { Compra };

const COMPS: ['locker' | 'regaderas' | 'preventas' | 'desc', string][] = [['locker', 'Locker'], ['regaderas', 'Regaderas'], ['preventas', 'Preventas'], ['desc', 'Descuento en tienda']];
const VIG: Record<Compra['vigencia'], [string, string]> = {
  por_iniciar: ['Por iniciar', 'st-conf'], vigente: ['Vigente', 'st-asis'], vencida: ['Vencida', 'st-noas'],
};

interface Fila { key: string; id?: string; ilim: boolean; e: string; n: string; u: 'dias' | 'meses'; c: string; porClase: Record<string, string> }
interface Form { nombre: string; desc: string; cls: string[]; dist: 'compartida' | 'por_clase'; filas: Fila[]; comp: string[]; pct: string; kit: boolean; kitd: string; activo: boolean }
const nuevaFila = (): Fila => ({ key: Math.random().toString(36).slice(2), ilim: false, e: '', n: '', u: 'dias', c: '', porClase: {} });

export default function Membresias() {
  const yo = useSesion();
  const esAdmin = yo.rol === 'administrador';
  const { toast, confirmar } = useFeedback();
  const { data, setData, error, loading, recargar } = useCarga(async () => {
    const [mem, clases, compras] = await Promise.all([
      admin.get<Membresia[]>('/membresias'),
      admin.get<Clase[]>('/clases'),
      apiCompras.listar().catch(() => [] as Compra[]),
    ]);
    return { mem, clases, compras };
  });
  const mem = data?.mem ?? [];
  const clases = data?.clases ?? [];
  const compras = data?.compras ?? [];
  const [vista, setVista] = useState<'cat' | 'compras'>('cat');
  const [q, setQ] = useState('');
  const [mF, setMF] = useState<'all' | 'on' | 'off'>('all');
  const [cF, setCF] = useState<'vigente' | 'vencida' | 'all'>('vigente');
  const [editId, setEditId] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState<Form | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [vender, setVender] = useState<Membresia | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const cName = (id: string) => clases.find((c) => c.idClase === id)?.nombre ?? 'Clase';
  const accesos = (m: Membresia) => (m.clasesIds?.length ? m.clasesIds.map(cName) : m.accesos);
  const rango = (m: Membresia) => {
    const c = m.opciones.map((o) => o.costo).filter((x): x is number => x !== null);
    if (!c.length) return 'Por definir';
    const a = Math.min(...c), b = Math.max(...c);
    return a === b ? money(a) : `${money(a)} a ${money(b)}`;
  };
  const activas = mem.filter((m) => m.estatus === 'activo');
  const precios = activas.flatMap((m) => m.opciones.map((o) => o.costo)).filter((x): x is number => x !== null);
  const lista = useMemo(() => mem
    .filter((m) => (mF === 'all' || (mF === 'on') === (m.estatus === 'activo')) && (!q || norm(`${m.nombre} ${m.descripcion} ${accesos(m).join(' ')}`).includes(norm(q))))
    .sort((a, b) => (a.estatus === b.estatus ? 0 : a.estatus === 'activo' ? -1 : 1)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [mem, mF, q, clases]);
  const comprasF = compras
    .filter((c) => cF === 'all' || (cF === 'vigente' ? ['vigente', 'por_iniciar'].includes(c.vigencia) : c.vigencia === cF))
    .filter((c) => !q || norm(`${c.nombreCliente} ${c.folio} ${c.condiciones?.nombre}`).includes(norm(q)));

  /* ---------- formulario ---------- */
  const abrir = (m?: Membresia) => {
    setEditId(m?.idMembresia ?? null);
    const dist = m?.opciones[0]?.distribucion ?? 'compartida';
    setF({
      nombre: m?.nombre ?? '', desc: m?.descripcion ?? '', cls: m?.clasesIds ?? [], dist,
      filas: m?.opciones.length ? m.opciones.map((o) => ({
        key: o.id, id: o.id, ilim: o.entradas === null, e: o.entradas === null ? '' : String(o.entradas),
        n: String(o.duracion ?? o.vigenciaDias ?? ''), u: o.unidadDuracion ?? 'dias', c: o.costo === null ? '' : String(o.costo),
        porClase: Object.fromEntries(Object.entries(o.entradasPorClase ?? {}).map(([k, v]) => [k, String(v)])),
      })) : [nuevaFila()],
      comp: m ? [...(['locker', 'regaderas', 'preventas'] as const).filter((k) => m.complementos?.[k]), ...(m.complementos?.descuento ? ['desc'] : [])] : [],
      pct: m?.complementos?.descuento ? String(m.complementos.descuento.porcentaje) : '',
      kit: !!m?.kit, kitd: m?.kit ? [...m.kit.productos, ...m.kit.cortesias].join(', ') : '', activo: m ? m.estatus === 'activo' : true,
    });
    setErrs({}); setAbierto(true);
  };
  const upd = (p: Partial<Form>) => setF((x) => (x ? { ...x, ...p } : x));
  const updFila = (key: string, p: Partial<Fila>) => upd({ filas: f!.filas.map((r) => (r.key === key ? { ...r, ...p } : r)) });
  const soloDig = (v: string) => v.replace(/\D/g, '').slice(0, 6);

  const guardar = async () => {
    if (!f) return;
    const e: Record<string, string> = {};
    if (!f.nombre.trim()) e.nombre = 'Escribe el nombre.';
    else if (mem.some((m) => norm(m.nombre) === norm(f.nombre) && m.idMembresia !== editId)) e.nombre = 'Ya existe una membresía con este nombre.';
    if (!f.cls.length) e.cls = 'Elige al menos una clase.';
    const porClase = f.dist === 'por_clase' && f.cls.length > 1;
    const opciones = f.filas.map((r) => {
      const epc = porClase ? Object.fromEntries(f.cls.map((id) => [id, Number(r.porClase[id] || 0)])) : undefined;
      const entradas = porClase ? Object.values(epc!).reduce((a, b) => a + b, 0) : r.ilim ? null : Number(r.e);
      const malo = (!r.ilim && !porClase && !(Number(r.e) > 0)) || (porClase && Object.values(epc!).some((v) => !(v > 0))) || !(Number(r.n) > 0) || r.c === '';
      if (malo) e.opts = 'Completa entradas, vigencia y costo de cada presentación.';
      return { ...(r.id ? { id: r.id } : {}), entradas, duracion: Number(r.n), unidadDuracion: r.u, distribucion: porClase ? 'por_clase' : 'compartida', ...(porClase ? { entradasPorClase: epc } : {}), costo: Number(r.c) };
    });
    if (f.comp.includes('desc') && !(Number(f.pct) > 0 && Number(f.pct) <= 100)) e.pct = 'Escribe un porcentaje entre 1 y 100.';
    if (f.kit && !f.kitd.trim()) e.kit = 'Describe qué incluye el kit.';
    setErrs(e);
    if (Object.keys(e).length) return;
    const cuerpo = {
      nombre: f.nombre.trim(), descripcion: f.desc.trim(), clasesIds: f.cls, accesos: f.cls.map(cName), opciones,
      complementos: { locker: f.comp.includes('locker'), regaderas: f.comp.includes('regaderas'), preventas: f.comp.includes('preventas'), descuento: f.comp.includes('desc') ? { porcentaje: Number(f.pct), aplicaEn: 'tienda' } : null },
      kit: f.kit ? { productos: f.kitd.split(/[,;\n]/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean), cortesias: [] } : null,
      estatus: f.activo ? 'activo' : 'inactivo',
    };
    setGuardando(true);
    try {
      if (editId) {
        const m = await admin.patch<Membresia>(`/membresias/${editId}`, cuerpo);
        setData((d) => d && { ...d, mem: d.mem.map((x) => (x.idMembresia === editId ? m : x)) });
        toast('Cambios guardados', `Actualizamos la membresía ${m.nombre}.`);
      } else {
        const m = await admin.post<Membresia>('/membresias', cuerpo);
        setData((d) => d && { ...d, mem: [m, ...d.mem] });
        toast('Membresía creada', f.activo ? `${m.nombre} ya está a la venta.` : `${m.nombre} se guardó como inactiva.`);
      }
      setAbierto(false);
    } catch (err) { toast('No se pudo guardar', mensajeError(err), 'error'); }
    finally { setGuardando(false); }
  };

  const alternar = async (m: Membresia) => {
    const activar = m.estatus !== 'activo';
    const ok = await confirmar(activar
      ? { t: `¿Reactivar ${m.nombre}?`, p: 'Volverá a estar a la venta en recepción y en la app.', y: 'Sí, reactivar', tono: 'ok' }
      : { t: `¿Dar de baja ${m.nombre}?`, p: 'Dejará de venderse en recepción y en la app. Quien ya la tiene la conserva hasta que venza.', y: 'Sí, dar de baja', n: 'No, mantenerla' });
    if (!ok) return;
    try {
      const r = await admin.patch<Membresia>(`/membresias/${m.idMembresia}`, { estatus: activar ? 'activo' : 'inactivo' });
      setData((d) => d && { ...d, mem: d.mem.map((x) => (x.idMembresia === m.idMembresia ? r : x)) });
      toast(activar ? 'Membresía reactivada' : 'Membresía dada de baja', activar ? `${m.nombre} ya está a la venta.` : `${m.nombre} ya no está a la venta.`);
    } catch (err) { toast('No se pudo actualizar', mensajeError(err), 'error'); }
  };

  const verTicket = async (c: Compra) => {
    try { setTicket(await apiCompras.ticket(c.idCompra)); }
    catch (e) { toast('No se pudo abrir el comprobante', mensajeError(e), 'error'); }
  };

  const hk = hoyClave();
  const porVencer = compras.filter((c) => c.vigencia === 'vigente' && c.fechaFin <= claveDia(sumarDias(hoy(), 7))).length;
  return (
    <>
      <Kpis items={vista === 'cat' ? [
        { label: 'Membresías activas', value: activas.length, tono: 'ok', icon: 'membresias' },
        { label: 'Membresías inactivas', value: mem.length - activas.length, tono: 'bad', icon: 'off' },
        { label: 'Con kit de bienvenida', value: activas.filter((m) => m.kit).length, tono: 'purple', icon: 'regalo' },
        { label: 'Precio desde', value: precios.length ? money(Math.min(...precios)) : '—', tono: 'accent', icon: 'etiqueta' },
        { label: 'Membresías vigentes', value: compras.filter((c) => c.vigencia === 'vigente').length, tono: 'blue', icon: 'grupo' },
      ] : [
        { label: 'Vendidas hoy', value: compras.filter((c) => claveDia(new Date(c.fechaCreacion)) === hk).length, tono: 'accent', icon: 'dinero' },
        { label: 'Membresías vigentes', value: compras.filter((c) => c.vigencia === 'vigente').length, tono: 'ok', icon: 'membresias' },
        { label: 'Por iniciar', value: compras.filter((c) => c.vigencia === 'por_iniciar').length, tono: 'blue', icon: 'calendario' },
        { label: 'Vencen en 7 días', value: porVencer, tono: 'warn', icon: 'alerta' },
        { label: 'Vencidas', value: compras.filter((c) => c.vigencia === 'vencida').length, tono: 'bad', icon: 'reloj' },
      ]} />
      <div className="vsw" role="tablist" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
        <button role="tab" className={vista === 'cat' ? 'on' : ''} onClick={() => setVista('cat')}><b>Catálogo de membresías</b><small>Accesos, vigencia y costo de cada presentación.</small></button>
        <button role="tab" className={vista === 'compras' ? 'on' : ''} onClick={() => setVista('compras')}><b>Membresías de clientes</b><small>Membresías vendidas en recepción: vigentes, por iniciar y vencidas.</small></button>
      </div>

      {vista === 'cat' ? (
        <>
          <SecHead title="Catálogo de membresías"><Search value={q} onChange={setQ} placeholder="Buscar membresía o clase" /></SecHead>
          <div className="tabrow"><Tabs value={mF} onChange={setMF} tabs={[['all', 'Todas', mem.length], ['on', 'Activas', activas.length], ['off', 'Inactivas', mem.length - activas.length]]} /></div>
          {error && <ErrorBox mensaje={error} onRetry={recargar} />}
          {loading ? <Cargando /> : (
            <div className="mwrap">
              <div className="mgrid">
                {lista.length ? lista.map((m) => {
                  const on = m.estatus === 'activo', acc = accesos(m), dist = m.opciones[0]?.distribucion;
                  return (
                    <article key={m.idMembresia} className={`mcard ${on ? '' : 'off'}`}>
                      <div className="mtop"><div><h3>{m.nombre}<PillEstatus activo={on} f /></h3>{m.descripcion && <p>{m.descripcion}</p>}</div>
                        <div className="mprice"><small>Costo</small><b>{rango(m)}</b></div></div>
                      <div className="mrow2">
                        <div><div className="mlbl">Acceso a{acc.length > 1 ? ` · ${dist === 'por_clase' ? 'entradas por clase' : 'entradas compartidas'}` : ''}</div>
                          <div className="chips">{acc.length ? acc.map((a) => <span className="chip2" key={a}>{a}</span>) : <span className="noreg">Sin registro</span>}</div></div>
                        <div><div className="mlbl">Incluye</div><div className="chips">
                          {m.complementos?.locker && <span className="chip2"><Icon n="check" w={2.4} />Locker</span>}
                          {m.complementos?.regaderas && <span className="chip2"><Icon n="check" w={2.4} />Regaderas</span>}
                          {m.complementos?.preventas && <span className="chip2"><Icon n="check" w={2.4} />Preventas</span>}
                          {m.complementos?.descuento && <span className="chip2"><Icon n="check" w={2.4} />{m.complementos.descuento.porcentaje}% de descuento en tienda</span>}
                          {m.kit && <span className="chip2 kit" title={[...m.kit.productos, ...m.kit.cortesias].join(', ')}><Icon n="regalo" />Kit de bienvenida</span>}
                          {!m.kit && !m.complementos?.locker && !m.complementos?.regaderas && !m.complementos?.preventas && !m.complementos?.descuento && <span className="noreg">Sin registro</span>}
                        </div></div>
                      </div>
                      <table className="otab"><thead><tr><th>Entradas</th><th>Vigencia</th><th>Costo</th></tr></thead><tbody>
                        {m.opciones.map((o) => <tr key={o.id}><td>{optEntradas(o)}</td><td>{optVigencia(o)}</td><td>{o.costo === null ? <span className="tbd">Por definir</span> : money(o.costo)}</td></tr>)}
                      </tbody></table>
                      <div className="mbtns">
                        {esAdmin && <button className="btn glass" onClick={() => abrir(m)}><Icon n="editar" />Editar</button>}
                        {on && m.clasesIds?.length ? <button className="btn glass" onClick={() => setVender(m)}><Icon n="dinero" />Vender</button> : null}
                        {esAdmin && (on ? <button className="btn cancel out" onClick={() => alternar(m)}>Dar de baja</button> : <button className="btn ok2" onClick={() => alternar(m)}>Reactivar</button>)}
                      </div>
                    </article>
                  );
                }) : <div className="soonbox" style={{ marginTop: 20 }}><b>No encontramos membresías</b><p>Prueba con otro nombre o filtro.</p></div>}
              </div>
              {esAdmin && <button className="maddbox" onClick={() => abrir()} aria-label="Agregar nueva membresía"><span className="mplus"><Icon n="mas" w={2.2} /></span><b>Nueva membresía</b><small>Define accesos, vigencia y costo</small></button>}
            </div>
          )}
        </>
      ) : (
        <>
          <SecHead title="Membresías de clientes"><Search value={q} onChange={setQ} placeholder="Buscar cliente, folio o membresía" /></SecHead>
          <div className="tabrow"><Tabs value={cF} onChange={setCF} tabs={[['vigente', 'Vigentes y por iniciar', compras.filter((c) => ['vigente', 'por_iniciar'].includes(c.vigencia)).length], ['vencida', 'Vencidas', compras.filter((c) => c.vigencia === 'vencida').length], ['all', 'Todas', compras.length]]} /></div>
          <table>
            <thead><tr><th>Cliente</th><th>Folio</th><th>Membresía</th><th>Vigencia</th><th className="r">Precio</th><th>Estatus</th><th className="r">Acciones</th></tr></thead>
            <tbody>
              {loading ? <Cargando cols={7} /> : comprasF.length ? comprasF.map((c) => (
                <tr className={`r ${c.vigencia === 'vencida' ? 'inact' : ''}`} key={c.idCompra}>
                  <td><div className="rcli"><Avatar texto={iniciales(c.nombreCliente)} /><div><b>{c.nombreCliente}</b><small style={{ textTransform: 'capitalize' }}>{c.metodoPago || 'Front desk'}</small></div></div></td>
                  <td className="fade mono">{c.folio || '—'}</td>
                  <td><div className="rcls"><b>{c.condiciones?.nombre}</b><small>{c.condiciones?.opcion ? `${optEntradas(c.condiciones.opcion)} · ${optVigencia(c.condiciones.opcion)}` : ''}</small></div></td>
                  <td className="fade dt">{c.fechaInicio ? <><b>{fechaCorta(c.fechaInicio)}</b><small>al {fechaCorta(c.fechaFin)}</small></> : <span className="none">Al pagar</span>}</td>
                  <td className="num">{money(c.precio)}</td>
                  <td><span className={`pill ${VIG[c.vigencia][1]}`}>{VIG[c.vigencia][0]}</span></td>
                  <td><div className="acts"><IB icon="imprimir" tip="Ver comprobante" onClick={() => verTicket(c)} /></div></td>
                </tr>
              )) : <EmptyRow cols={7} title="Sin membresías" text="No hay membresías de clientes con este filtro." />}
            </tbody>
          </table>
        </>
      )}

      {f && (
        <Drawer open={abierto} wide onClose={() => setAbierto(false)} onSubmit={guardar}
          title={editId ? 'Editar membresía' : 'Nueva membresía'} sub={editId ? f.nombre : 'Define qué incluye, cuánto dura y cuánto cuesta.'}
          footer={<DrawerFooter label={editId ? 'Guardar cambios' : 'Crear membresía'} onSave={guardar} onCancel={() => setAbierto(false)} saving={guardando} />}>
          <div className="lbl">Datos generales</div>
          <div className="sbox">
            <Field label="Nombre de la membresía" req error={errs.nombre}><input placeholder="Ej. Force Room" value={f.nombre} onChange={(e) => { upd({ nombre: e.target.value }); setErrs({ ...errs, nombre: '' }); }} /></Field>
            <Field label="Descripción" opt last hint="Así la verán los clientes en la app."><textarea rows={2} placeholder="Ej. Solo clases. / Flow Room + Force Room ilimitados." value={f.desc} onChange={(e) => upd({ desc: e.target.value })} /></Field>
          </div>
          <div className="lbl">Clases incluidas <em className="req">*</em></div>
          <div className={`sbox ${errs.cls ? 'err' : ''}`} id="fm-cls">
            <p className="shint">Elige a qué áreas o clases da acceso esta membresía.</p>
            <div className="cgrid">
              {clases.filter((c) => c.estatus === 'activo' || f.cls.includes(c.idClase)).map((c) => (
                <label className="cpick" key={c.idClase}><input type="checkbox" checked={f.cls.includes(c.idClase)} onChange={(e) => { upd({ cls: e.target.checked ? [...f.cls, c.idClase] : f.cls.filter((x) => x !== c.idClase) }); setErrs({ ...errs, cls: '' }); }} />
                  <span className="box2" /><span>{c.nombre}<small>{c.descripcion}</small></span></label>
              ))}
            </div>
            <div className="rmsg">Elige al menos una clase.</div>
          </div>
          <div className="lbl">Entradas, vigencia y costo <em className="req">*</em></div>
          <div className={`sbox ${errs.opts ? 'err' : ''}`} id="fm-opt">
            <p className="shint">Cada fila es una presentación que se puede vender. Los meses cuentan como meses de calendario, no como 30 días.</p>
            {f.cls.length > 1 && (
              <Field label="Distribución de entradas" hint={f.dist === 'compartida' ? 'Las entradas se pueden usar en cualquiera de las clases incluidas.' : 'Cada clase incluida tiene su propio número de entradas.'}>
                <div className="seg2"><button type="button" className={f.dist === 'compartida' ? 'on' : ''} onClick={() => upd({ dist: 'compartida' })}>Bolsa compartida</button>
                  <button type="button" className={f.dist === 'por_clase' ? 'on' : ''} onClick={() => upd({ dist: 'por_clase' })}>Por cada clase</button></div>
              </Field>
            )}
            <div className="ohead"><span>Entradas</span><span>Vigencia</span><span>Costo (MXN)</span><span /></div>
            {f.filas.map((r) => {
              const pc = f.dist === 'por_clase' && f.cls.length > 1;
              return (
                <div key={r.key}>
                  <div className="orow">
                    <div className="pair">
                      {pc ? <input disabled value={f.cls.reduce((a, id) => a + Number(r.porClase[id] || 0), 0) || ''} placeholder="Suma" aria-label="Total de entradas" />
                        : <input inputMode="numeric" placeholder="Ej. 12" disabled={r.ilim} value={r.e} onChange={(e) => updFila(r.key, { e: soloDig(e.target.value) })} aria-label="Número de entradas" />}
                      {!pc && <label className="ilim"><input type="checkbox" checked={r.ilim} onChange={(e) => updFila(r.key, { ilim: e.target.checked, e: '' })} /><span className="box2" />Ilimitado</label>}
                    </div>
                    <div className="pair"><input inputMode="numeric" placeholder="Ej. 30" value={r.n} onChange={(e) => updFila(r.key, { n: soloDig(e.target.value) })} aria-label="Duración" />
                      <select value={r.u} onChange={(e) => updFila(r.key, { u: e.target.value as Fila['u'] })} aria-label="Unidad"><option value="dias">días</option><option value="meses">meses</option></select></div>
                    <div className="money"><span>$</span><input inputMode="numeric" placeholder="0" value={r.c} onChange={(e) => updFila(r.key, { c: soloDig(e.target.value) })} aria-label="Costo" /></div>
                    <button type="button" className="orm" disabled={f.filas.length === 1} onClick={() => upd({ filas: f.filas.filter((x) => x.key !== r.key) })} aria-label="Quitar presentación"><Icon n="x" w={2.6} /></button>
                  </div>
                  {pc && <div className="nu-pc">{f.cls.map((id) => (
                    <label key={id}><span>{cName(id)}</span><input inputMode="numeric" placeholder="0" value={r.porClase[id] ?? ''} onChange={(e) => updFila(r.key, { porClase: { ...r.porClase, [id]: soloDig(e.target.value) } })} /></label>))}</div>}
                </div>
              );
            })}
            {errs.opts && <div className="rmsg" style={{ display: 'block' }}>{errs.opts}</div>}
            <button type="button" className="btn line sm addopt" onClick={() => upd({ filas: [...f.filas, nuevaFila()] })}><Icon n="mas" w={2.4} />Agregar presentación</button>
          </div>
          <div className="lbl">Complementos <span className="opt">Opcional</span></div>
          <div className="sbox">
            <p className="shint">Servicios adicionales que incluye la membresía.</p>
            <div className="cgrid">{COMPS.map(([k, l]) => (
              <label className="cpick" key={k}><input type="checkbox" checked={f.comp.includes(k)} onChange={(e) => upd({ comp: e.target.checked ? [...f.comp, k] : f.comp.filter((x) => x !== k) })} /><span className="box2" /><span>{l}</span></label>))}</div>
            {f.comp.includes('desc') && <Field label="Porcentaje de descuento en tienda" last error={errs.pct} style={{ marginTop: 14 }}><div className="pctw"><input inputMode="numeric" placeholder="10" maxLength={3} value={f.pct} onChange={(e) => upd({ pct: e.target.value.replace(/\D/g, '').slice(0, 3) })} /><span>%</span></div></Field>}
          </div>
          <div className="lbl">Kit de bienvenida <span className="opt">Opcional</span></div>
          <div className="sbox">
            <label className="chk" style={{ margin: '0 -8px' }}><input type="checkbox" checked={f.kit} onChange={(e) => upd({ kit: e.target.checked })} /><span className="box2" />Esta membresía incluye kit de bienvenida</label>
            {f.kit && <Field label="¿Qué incluye el kit?" last error={errs.kit} style={{ marginTop: 10 }}><textarea rows={2} placeholder="Ej. Playera, termo y toalla." value={f.kitd} onChange={(e) => upd({ kitd: e.target.value })} /></Field>}
            <div style={{ height: 14 }} />
          </div>
          <div className="lbl">Estatus</div>
          <div className="sbox stsb">
            <EstatusSeg f activo={f.activo} onChange={(v) => upd({ activo: v })}
              textoOn={<><b style={{ color: 'var(--ink)' }}>Se puede vender</b> en recepción y en la app.</>}
              textoOff={<><b style={{ color: 'var(--ink)' }}>No se mostrará a la venta.</b> Quien ya la tiene la conserva hasta que venza.</>} />
          </div>
        </Drawer>
      )}

      <VentaMembresia open={!!vender} membresia={vender} onClose={() => setVender(null)} onVendida={(t) => { setVender(null); setTicket(t); void recargar(true); }} />
      <TicketDialog ticket={ticket} onClose={() => setTicket(null)} />
    </>
  );
}
