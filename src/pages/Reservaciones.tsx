import { useEffect, useMemo, useState } from 'react';
import { admin, cobro, mensajeError } from '../lib/api';
import { clientes as apiClientes, reservaciones as apiRes, type Cliente, type Reservacion } from '../lib/datos';
import { claveDia, coincideNombre, deClave, diasEntre, DOW, hora12, hoy, hoyClave, iniciales, MES, money, norm, sumarDias } from '../lib/format';
import { useSesion } from '../shell/AppShell';
import { Icon } from '../ui/Icon';
import { CobroDrawer, TicketDialog, type Ticket } from '../ui/Cobro';
import { Avatar, Cargando, Drawer, DrawerFooter, EmptyRow, ErrorBox, Field, IB, Kpis, Periodo, Search, SecHead, Tabs, useCarga, useFeedback } from '../ui/kit';

export type { Reservacion };
export interface Horario {
  idHorario: string; idClase: string; nombreClase: string; nombreEntrenador: string; fecha: string; horaInicio: string; horaFin: string;
  capacidadTotal: number; capacidadDisponible: number; estatus: string; visibleReservas?: boolean; listaEsperaHabilitada?: boolean;
}
interface Clase { idClase: string; nombre: string; color?: string; estatus: string }
type ClienteMin = Cliente;

type Est = 'pend' | 'conf' | 'asis' | 'noas' | 'canc';
const RST: Record<Est, string> = { pend: 'Pendiente', conf: 'Confirmada', asis: 'Asistió', noas: 'No asistió', canc: 'Cancelada' };
export const estadoDe = (r: Reservacion): Est =>
  r.estatus === 'cancelada' ? 'canc' : r.estatus === 'no_asistio' ? 'noas' : r.asistenciaConfirmada ? 'asis' : r.estatus === 'confirmada' ? 'conf' : 'pend';
export const horas = (hc: string) => { const m = hc.match(/\d{1,2}:\d{2}/g) ?? []; return { ini: m[0] ?? '', fin: m[1] ?? '' }; };
const inicio = (r: Reservacion) => { const d = deClave(r.fechaClase); const [h, mi] = horas(r.horaClase).ini.split(':').map(Number); d.setHours(h || 0, mi || 0); return d; };
export const colorClase = (clases: Clase[], idOrNombre: string) => {
  const c = clases.find((x) => x.idClase === idOrNombre || x.nombre === idOrNombre);
  return c?.color || 'var(--accent)';
};

/** Selector de día (7 días) + horario disponible, compartido por "Nueva reservación" y "Reagendar". */
export function SlotPicker({ horarios, clase, valor, onChange, excluir }: { horarios: Horario[]; clase: string; valor: string; onChange: (id: string) => void; excluir?: string }) {
  const ahora = new Date();
  const futuro = (h: Horario) => { const d = deClave(h.fecha); const [a, b] = h.horaInicio.split(':').map(Number); d.setHours(a, b); return d > ahora; };
  const delaClase = horarios.filter((h) => (h.idClase === clase || h.nombreClase === clase) && h.idHorario !== excluir && h.visibleReservas !== false && futuro(h));
  const dias = Array.from({ length: 7 }, (_, k) => sumarDias(hoy(), k));
  const primero = dias.find((d) => delaClase.some((h) => h.fecha === claveDia(d)));
  const [dia, setDia] = useState<string>(primero ? claveDia(primero) : hoyClave());
  useEffect(() => { setDia(primero ? claveDia(primero) : hoyClave()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clase]);
  const slots = delaClase.filter((h) => h.fecha === dia);
  return (
    <>
      <div className="fld" style={{ marginBottom: 12 }}><label>Día</label>
        <div className="days">{dias.map((d, k) => {
          const kd = claveDia(d), has = delaClase.some((h) => h.fecha === kd);
          return <button type="button" key={kd} className={dia === kd ? 'on' : ''} disabled={!has} onClick={() => { setDia(kd); onChange(''); }}><small>{k === 0 ? 'Hoy' : DOW[d.getDay()]}</small><b>{d.getDate()}</b></button>;
        })}</div>
      </div>
      <div className="fld last"><label>Horario disponible <em className="req">*</em></label>
        <div className="slots">{slots.length ? slots.map((h) => {
          const left = h.capacidadDisponible, espera = left <= 0 && h.listaEsperaHabilitada;
          return (
            <button type="button" key={h.idHorario} className={`slot ${valor === h.idHorario ? 'on' : ''}`} disabled={left <= 0 && !espera} onClick={() => onChange(h.idHorario)}>
              <span><b>{hora12(h.horaInicio)} – {hora12(h.horaFin)}</b><small>con {h.nombreEntrenador || 'Sin asignar'}</small></span>
              <span className={`cap ${left <= 0 ? 'full' : left <= 3 ? 'few' : ''}`}>{left <= 0 ? (espera ? 'Lista de espera' : 'Lleno') : left === 1 ? '1 lugar' : `${left} lugares`}</span>
            </button>
          );
        }) : <div className="noslots">No hay horarios disponibles este día.</div>}</div>
      </div>
    </>
  );
}

export default function Reservaciones() {
  const yo = useSesion();
  const { toast, confirmar } = useFeedback();
  const { data, setData, error, loading, recargar } = useCarga(async () => {
    // Todos los horarios sirven para mostrar el coach de cada reservación; los reservables, para elegir lugar.
    const [todos, horarios, clases, clientes] = await Promise.all([
      admin.get<Horario[]>('/horarios').catch(() => [] as Horario[]),
      admin.get<Horario[]>('/horarios/reservables').catch(() => [] as Horario[]),
      admin.get<Clase[]>('/clases'),
      apiClientes.listar().then((l) => l.filter((c) => c.estatus === 'activo')).catch(() => [] as ClienteMin[]),
    ]);
    const res = await apiRes.listar(todos);
    return { res, todos, horarios, clases, clientes };
  });
  const res = data?.res ?? [];
  const clases = data?.clases ?? [];
  const [q, setQ] = useState('');
  const [per, setPer] = useState<'today' | 'tom' | '7' | 'all'>('today');
  const [tab, setTab] = useState<'all' | Est>('all');
  const [rg, setRg] = useState<Reservacion | null>(null);
  const [rgSlot, setRgSlot] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const [nCli, setNCli] = useState<ClienteMin | null>(null);
  const [nQ, setNQ] = useState('');
  const [nVisit, setNVisit] = useState('');
  const [nTipo, setNTipo] = useState<'cliente' | 'visitante'>('cliente');
  const [nCls, setNCls] = useState('');
  const [nSlot, setNSlot] = useState('');
  const [nErr, setNErr] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [cobrar, setCobrar] = useState<Reservacion | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const t0 = hoy();
  const enPeriodo = (r: Reservacion) => { const k = diasEntre(t0, deClave(r.fechaClase)); return per === 'today' ? k === 0 : per === 'tom' ? k === 1 : per === '7' ? k >= 0 && k <= 6 : true; };
  const Q = useMemo(() => res.filter((r) => enPeriodo(r) && (!q || coincideNombre(r.nombreCliente, q) || norm(`${r.codigo} ${r.clase} ${r.entrenador}`).includes(norm(q)))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [res, per, q]);
  const L = Q.filter((r) => tab === 'all' || estadoDe(r) === tab).sort((a, b) => inicio(a).getTime() - inicio(b).getTime() || a.nombreCliente.localeCompare(b.nombreCliente, 'es'));
  const deHoy = res.filter((r) => r.fechaClase === hoyClave());
  const delMes = res.filter((r) => { const d = deClave(r.fechaClase); return d.getMonth() === t0.getMonth() && d.getFullYear() === t0.getFullYear(); });

  const reemplazar = (r: Reservacion) => setData((d) => d && { ...d, res: d.res.map((x) => (x.idReservacion === r.idReservacion ? { ...x, ...r } : x)) });
  const accion = async (r: Reservacion, ruta: 'asistencia' | 'cancelar' | 'reagendar', ok: [string, string], horario?: Horario) => {
    const H = data?.todos ?? [];
    try {
      const x = ruta === 'asistencia' ? await apiRes.asistencia(r.idReservacion, H)
        : ruta === 'cancelar' ? await apiRes.cancelar(r.idReservacion, H)
          : await apiRes.reagendar(r.idReservacion, { idHorario: horario!.idHorario, fecha: horario!.fecha }, H);
      reemplazar(x.reservacion);
      if (x.promovida) reemplazar(x.promovida);
      toast(ok[0], ok[1] + (x.promovida ? ` ${x.promovida.nombreCliente} subió de la lista de espera.` : ''));
      void recargar(true);
    } catch (e) { toast('No se pudo completar', mensajeError(e), 'error'); }
  };

  const canDo = (r: Reservacion) => {
    const ahora = new Date(), st = inicio(r), e = estadoDe(r), abierta = e === 'pend' || e === 'conf';
    const fin = ({ asis: 'Ya asistió', noas: 'Marcada como inasistencia', canc: 'Reservación cancelada' } as Record<string, string>)[e];
    return {
      rg: !abierta ? fin : r.puedeReagendar === false ? (r.motivoNoReagendar ?? 'No se puede reagendar') : r.reagendada ? 'Ya se reagendó una vez' : st <= ahora ? 'La clase ya empezó' : '',
      ok: !abierta ? fin : r.fechaClase > hoyClave() ? 'Disponible el día de la clase' : r.estadoPago !== 'pagado' && r.precio > 0 ? 'Primero cobra la clase' : r.estadoCupo === 'espera' ? 'Está en lista de espera' : '',
      cc: !abierta ? fin : r.puedeCancelar === false ? (r.motivoNoCancelar ?? 'No se puede cancelar') : st <= ahora ? 'La clase ya empezó' : '',
    };
  };

  const crear = async () => {
    const e: Record<string, string> = {};
    if (nTipo === 'cliente' && !nCli) e.cli = 'Elige un cliente.';
    if (nTipo === 'visitante' && nVisit.trim().length < 3) e.cli = 'Escribe el nombre del visitante.';
    if (!nSlot) e.slot = 'Elige un horario.';
    setNErr(e);
    if (Object.keys(e).length) return;
    setGuardando(true);
    try {
      const horario = (data?.horarios ?? []).find((h) => h.idHorario === nSlot)!;
      const { reservacion: r } = await apiRes.crear(nTipo === 'cliente'
        ? { horario, cliente: { id: nCli!.idUsuario, nombre: `${nCli!.nombre} ${nCli!.apellidos}`.trim() } }
        : { horario, visitante: nVisit.trim() }, data?.todos ?? []);
      setData((d) => d && { ...d, res: [r, ...d.res] });
      setNuevo(false);
      toast('Reservación creada', `${r.nombreCliente}: ${r.clase}, ${r.fechaClase} a las ${hora12(horas(r.horaClase).ini)} · Código ${r.codigo}${r.estadoCupo === 'espera' ? ' (lista de espera)' : ''}`);
      void recargar(true);
    } catch (err) { toast('No se pudo reservar', mensajeError(err), 'error'); }
    finally { setGuardando(false); }
  };

  const reagendar = async () => {
    if (!rg) return;
    if (!rgSlot) { toast('Elige un horario', 'Selecciona el nuevo horario para reagendar.', 'error'); return; }
    const r = rg;
    setRg(null);
    const horario = (data?.horarios ?? []).find((h) => h.idHorario === rgSlot);
    await accion(r, 'reagendar', ['Reservación reagendada', `${r.nombreCliente}: ${r.clase}. Ya no podrá volver a reagendarse.`], horario);
  };

  const cobrarReserva = async (p: object) => {
    if (!cobrar) return;
    try {
      const r = await cobro.post<{ ticket: Ticket }>('/cobros', { reservaId: Number(cobrar.idReservacion), ...p });
      r.ticket.usuario = `${yo.nombre} ${yo.apellidos}`.trim();
      setCobrar(null); setTicket(r.ticket); void recargar(true);
      toast('Cobro registrado', `${cobrar.nombreCliente} · ${cobrar.clase}`);
    } catch (e) { toast('No se pudo cobrar', mensajeError(e), 'error'); }
  };

  const clasesActivas = clases.filter((c) => c.estatus === 'activo');
  const abrirNuevo = () => { setNuevo(true); setNCli(null); setNQ(''); setNVisit(''); setNTipo('cliente'); setNCls(clasesActivas[0]?.idClase ?? ''); setNSlot(''); setNErr({}); };
  const sugeridos = nQ.trim() ? (data?.clientes ?? []).filter((c) => coincideNombre(`${c.nombre} ${c.apellidos}`, nQ)).slice(0, 6) : [];
  const esRecepcion = yo.rol === 'recepcion';

  return (
    <>
      <Kpis items={[
        { label: 'Reservaciones de hoy', value: deHoy.filter((r) => r.estatus !== 'cancelada').length, tono: 'blue', icon: 'reservaciones' },
        { label: 'Asistencias de hoy', value: deHoy.filter((r) => estadoDe(r) === 'asis').length, tono: 'ok', icon: 'on' },
        { label: 'Por registrar hoy', value: deHoy.filter((r) => ['pend', 'conf'].includes(estadoDe(r))).length, tono: 'accent', icon: 'reloj' },
        { label: 'Inasistencias del mes', value: delMes.filter((r) => r.estatus === 'no_asistio').length, tono: 'warn', icon: 'inasistencia' },
        { label: 'Cancelaciones del mes', value: delMes.filter((r) => r.estatus === 'cancelada').length, tono: 'bad', icon: 'off' },
      ]} />
      <SecHead title="Reservaciones">
        <Search value={q} onChange={setQ} placeholder="Buscar cliente (nombre o apellido), código, clase o coach" />
        <Periodo style={{ marginLeft: 'auto', borderLeft: 'none' }} value={per} onChange={setPer} opciones={[['today', 'Hoy'], ['tom', 'Mañana'], ['7', 'Próximos 7 días'], ['all', 'Todas']]} />
      </SecHead>
      <div className="tabrow">
        <Tabs value={tab} onChange={setTab} tabs={[['all', 'Todas', Q.length], ...(['pend', 'conf', 'asis', 'canc', 'noas'] as Est[]).map((k) => [k, RST[k], Q.filter((r) => estadoDe(r) === k).length] as [Est, string, number])]} />
        <div className="polw"><button type="button" className="poli" aria-label="Ver políticas de reservación"><Icon n="alerta" /></button>
          <div className="poltip" role="tooltip"><b>Políticas</b><ul>
            <li><strong>Reagendar:</strong> una sola vez y sin costo.</li>
            <li><strong>Cancelar:</strong> el cliente, hasta 24 h antes de la clase; sin reembolso.</li>
            <li><strong>Inasistencia:</strong> se registra sola cuando pasa la clase sin asistencia; sin reembolso ni reagendación.</li></ul></div></div>
        <button className="btn acc" style={{ marginLeft: 'auto' }} onClick={abrirNuevo}><Icon n="mas" w={2.4} />Nueva reservación</button>
      </div>
      {error && <ErrorBox mensaje={error} onRetry={recargar} />}
      <table className="rtab">
        <thead><tr><th>Horario</th><th>Cliente</th><th>Clase</th><th>Estatus</th><th className="r">Acciones</th></tr></thead>
        <tbody>
          {loading ? <Cargando cols={5} /> : L.length ? L.map((r) => {
            const k = diasEntre(t0, deClave(r.fechaClase)), d = deClave(r.fechaClase), h = horas(r.horaClase), e = estadoDe(r), a = canDo(r);
            const lbl = k === 0 ? 'Hoy' : k === 1 ? 'Mañana' : k === -1 ? 'Ayer' : `${DOW[d.getDay()]} ${d.getDate()} ${MES[d.getMonth()]}`;
            const porPagar = r.estadoPago !== 'pagado' && r.precio > 0 && (e === 'pend' || e === 'conf');
            return (
              <tr key={r.idReservacion} className={`r ${e === 'canc' ? 'inact' : ''}`}>
                <td><div className="rtime"><b>{hora12(h.ini)}</b><small>{lbl}{h.fin ? ` · a ${hora12(h.fin)}` : ''}</small></div></td>
                <td><div className="rcli"><Avatar texto={iniciales(r.nombreCliente)} /><div><b>{r.nombreCliente}{r.tipo === 'visitante' && <span className="you" style={{ background: 'var(--card2)', color: 'var(--ink2)' }}>Visitante</span>}</b>
                  <span className="rcode">{r.codigo}</span> <span className="nu-origen" style={{ display: 'inline-flex' }}><Icon n={r.origen === 'app' ? 'app' : 'web'} />{r.origen === 'app' ? 'App' : 'Recepción'}</span></div></div></td>
                <td><div className="rcls"><b><span className="cdot" style={{ background: colorClase(clases, r.claseId || r.clase) }} />{r.clase}</b><small>con {r.entrenador || 'Sin asignar'}</small></div></td>
                <td><span className={`pill st-${e}`}>{RST[e]}</span>
                  {r.estadoCupo === 'espera' && e !== 'canc' && <span className="rgtag"><Icon n="reloj" />Lista de espera</span>}
                  {porPagar && <span className="rgtag" style={{ color: 'var(--warn)' }}><Icon n="dinero" />Por pagar {money(r.precio)}</span>}
                  {r.reagendada && <span className="rgtag"><Icon n="reagendar" />Reagendada</span>}</td>
                <td><div className="acts">
                  {porPagar && esRecepcion && r.estadoCupo !== 'espera' && <IB icon="dinero" kind="mv" tip={`Cobrar ${money(r.precio)}`} onClick={() => setCobrar(r)} />}
                  <IB icon="calendario" tip="Reagendar" na={a.rg} onClick={() => { setRg(r); setRgSlot(''); }} />
                  <IB icon="on" kind="on" tip="Registrar asistencia" na={a.ok} onClick={async () => {
                    if (await confirmar({ t: `¿Registrar asistencia de ${r.nombreCliente}?`, p: `${r.clase} de las ${hora12(h.ini)} con ${r.entrenador}`, y: 'Sí, registrar asistencia', tono: 'ok' }))
                      void accion(r, 'asistencia', ['Asistencia registrada', `${r.nombreCliente} · ${r.clase} ${hora12(h.ini)}`]);
                  }} />
                  <IB icon="off" kind="off" tip="Cancelar reservación" na={a.cc} onClick={async () => {
                    if (await confirmar({ t: `¿Cancelar la reservación de ${r.nombreCliente}?`, p: `${r.clase} · ${d.getDate()} ${MES[d.getMonth()]} ${hora12(h.ini)}. Se libera el lugar y no hay reembolso.`, y: 'Sí, cancelar reservación', n: 'No, mantenerla' }))
                      void accion(r, 'cancelar', ['Reservación cancelada', `Se liberó el lugar en ${r.clase} de las ${hora12(h.ini)}.`]);
                  }} />
                </div></td>
              </tr>
            );
          }) : <EmptyRow cols={5} title="Sin reservaciones" text="No hay reservaciones con estos filtros en el periodo elegido." />}
        </tbody>
      </table>

      <Drawer open={!!rg} onClose={() => setRg(null)} onSubmit={reagendar} title="Reagendar reservación" sub="Elige el nuevo horario para la misma clase."
        footer={<DrawerFooter label="Reagendar" onSave={reagendar} onCancel={() => setRg(null)} />}>
        {rg && <>
          <div className="lbl">Reservación actual</div>
          <div className="sbox"><div className="rsum"><Avatar texto={iniciales(rg.nombreCliente)} size={42} /><div><b>{rg.nombreCliente}</b><small>Reservación <span className="rcode">{rg.codigo}</span></small></div>
            <div className="rline"><span><span className="cdot" style={{ background: colorClase(clases, rg.claseId || rg.clase) }} /><b>{rg.clase}</b></span><span>{rg.fechaClase} · <b>{hora12(horas(rg.horaClase).ini)}</b></span><span>con {rg.entrenador || 'Sin asignar'}</span></div></div><div style={{ height: 16 }} /></div>
          <div className="lbl">Nuevo horario</div>
          <div className="sbox"><SlotPicker horarios={data?.horarios ?? []} clase={rg.claseId || rg.clase} valor={rgSlot} onChange={setRgSlot} excluir={rg.idHorario} /></div>
          <div className="stbox warnb"><span className="sti"><Icon n="info" /></span><span><b style={{ color: 'var(--ink)' }}>Solo se puede reagendar una vez</b> y no tiene costo. Después la reservación ya no podrá reagendarse.</span></div>
          <div style={{ height: 22 }} />
        </>}
      </Drawer>

      <Drawer open={nuevo} onClose={() => setNuevo(false)} onSubmit={crear} title="Nueva reservación" sub="Reserva un lugar a nombre de un cliente."
        footer={<DrawerFooter label="Crear reservación" onSave={crear} onCancel={() => setNuevo(false)} saving={guardando} />}>
        <div className="lbl">Cliente</div>
        <div className="sbox">
          <div className="seg2" style={{ marginBottom: 14 }}>
            <button type="button" className={nTipo === 'cliente' ? 'on' : ''} onClick={() => setNTipo('cliente')}>Cliente registrado</button>
            <button type="button" className={nTipo === 'visitante' ? 'on' : ''} onClick={() => setNTipo('visitante')}>Visitante</button>
          </div>
          {nTipo === 'cliente' ? (
            <Field label="Cliente" req last error={nErr.cli}>
              {nCli ? <div className="nu-pick"><span><b>{nCli.nombre} {nCli.apellidos}</b><small className="mono">{nCli.codigoAcceso}</small></span><button type="button" className="plink" onClick={() => setNCli(null)}>Cambiar</button></div>
                : <div className="nu-combo"><div className="hadd"><input placeholder="Buscar por nombre y/o apellido" value={nQ} onChange={(e) => setNQ(e.target.value)} /></div>
                  {sugeridos.length > 0 && <ul className="nu-opts">{sugeridos.map((c) => <li key={c.idUsuario} onMouseDown={(e) => { e.preventDefault(); setNCli(c); setNErr({}); }}>{c.nombre} {c.apellidos}</li>)}</ul>}</div>}
            </Field>
          ) : (
            <Field label="Nombre del visitante" req last error={nErr.cli}><input value={nVisit} onChange={(e) => setNVisit(e.target.value)} placeholder="Nombre completo" /></Field>
          )}
        </div>
        <div className="lbl">Clase y horario</div>
        <div className={`sbox ${nErr.slot ? '' : ''}`}>
          <div className="fld" style={{ marginBottom: 12 }}><label>Clase <em className="req">*</em></label>
            <div className="catpick">{clasesActivas.map((c) => <button type="button" key={c.idClase} className={nCls === c.idClase ? 'on' : ''} onClick={() => { setNCls(c.idClase); setNSlot(''); }}><span className="cdot" style={{ background: c.color || 'var(--accent)' }} />{c.nombre}</button>)}</div></div>
          <div className={nErr.slot ? 'fld err' : ''}><SlotPicker horarios={data?.horarios ?? []} clase={nCls} valor={nSlot} onChange={(v) => { setNSlot(v); setNErr({ ...nErr, slot: '' }); }} />
            {nErr.slot && <div className="msg" style={{ display: 'block', color: 'var(--bad)', fontSize: 12.5, marginTop: -8, marginBottom: 14 }}>{nErr.slot}</div>}</div>
        </div>
        <p className="shint">Si el cliente tiene una membresía vigente que cubre la clase, se usa automáticamente. Si no, la clase queda por pagar en recepción.</p>
      </Drawer>

      <CobroDrawer open={!!cobrar} onClose={() => setCobrar(null)} titulo="Cobrar clase" sub={cobrar?.codigo} total={cobrar?.precio ?? 0} onCobrar={cobrarReserva}
        resumen={cobrar && <div className="rsum" style={{ paddingTop: 0 }}><Avatar texto={iniciales(cobrar.nombreCliente)} size={42} /><div><b>{cobrar.nombreCliente}</b><small>Reservación <span className="rcode">{cobrar.codigo}</span></small></div>
          <div className="rline"><span><b>{cobrar.clase}</b></span><span>{cobrar.fechaClase} · {hora12(horas(cobrar.horaClase).ini)}</span><span>con {cobrar.entrenador}</span></div></div>} />
      <TicketDialog ticket={ticket} onClose={() => setTicket(null)} />
    </>
  );
}
