import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin, cobro, mensajeError } from '../lib/api';
import { claveDia, fechaCorta, hora12, hoyClave, iniciales, money } from '../lib/format';
import { useSesion } from '../shell/AppShell';
import { Icon, type IconName } from '../ui/Icon';
import { CobroDrawer, TicketDialog, type Ticket } from '../ui/Cobro';
import { Avatar, Cargando, ErrorBox, IB, Kpis, useCarga, useFeedback } from '../ui/kit';
import { colorClase, estadoDe, horas, type Horario, type Reservacion } from './Reservaciones';
import { compras as apiCompras, reservaciones as apiRes, type Compra } from '../lib/datos';
import { optEntradas } from '../ui/VentaMembresia';

const RST: Record<string, string> = { pend: 'Pendiente', conf: 'Confirmada', asis: 'Asistió', noas: 'No asistió', canc: 'Cancelada' };
type Hallazgo = { r: Reservacion } | null;

export default function Recepcion() {
  const yo = useSesion();
  const nav = useNavigate();
  const { toast, confirmar } = useFeedback();
  const { data, error, loading, recargar } = useCarga(async () => {
    const [kpis, horarios, compras, clases] = await Promise.all([
      cobro.get<{ ingresosHoy: number; clientesEsperados: number; totalReservas: number }>('/kpis').catch(() => ({ ingresosHoy: 0, clientesEsperados: 0, totalReservas: 0 })),
      admin.get<Horario[]>(`/horarios?fecha=${hoyClave()}&estatus=activo`).catch(() => [] as Horario[]),
      apiCompras.listar().catch(() => [] as Compra[]),
      admin.get<{ idClase: string; nombre: string; color?: string; estatus: string }[]>('/clases'),
    ]);
    const res = (await apiRes.listar(horarios)).filter((r) => r.fechaClase === hoyClave());
    return { kpis, res, horarios, compras: compras.filter((c) => claveDia(new Date(c.fechaCreacion)) === hoyClave() || c.fechaInicio === hoyClave()), clases };
  });
  const [codigo, setCodigo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [hallazgo, setHallazgo] = useState<Hallazgo>(null);
  const [codErr, setCodErr] = useState('');
  const [cobrarR, setCobrarR] = useState<Reservacion | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);

  const buscar = async (valor = codigo) => {
    const c = valor.trim().toUpperCase().replace(/\s+/g, '');
    const m = /^(NU|PQ)-?(\d{5})$/.exec(c) ?? /^(RSV)-?([A-Z0-9]{6})$/.exec(c);
    if (!m) { setCodErr('Escribe un código con el formato NU-12345 (clase por pagar) o PQ-12345 (clase cubierta por membresía).'); return; }
    const cod = `${m[1]}-${m[2]}`;
    setCodigo(cod); setCodErr(''); setBuscando(true); setHallazgo(null);
    try { setHallazgo({ r: await apiRes.porCodigo(cod, data?.horarios ?? []) }); }
    catch (e) { setCodErr((e as { status?: number }).status === 404 ? `No existe una reservación con el código ${cod}.` : mensajeError(e)); }
    finally { setBuscando(false); }
  };

  const asistencia = async (r: Reservacion) => {
    if (!(await confirmar({ t: `¿Registrar asistencia de ${r.nombreCliente}?`, p: `${r.clase} de las ${hora12(horas(r.horaClase).ini)}`, y: 'Sí, registrar asistencia', tono: 'ok' }))) return;
    try {
      const { reservacion: x } = await apiRes.asistencia(r.idReservacion, data?.horarios ?? []);
      toast('Asistencia registrada', `${x.nombreCliente} · ${x.clase}`);
      if (hallazgo && hallazgo.r.idReservacion === x.idReservacion) setHallazgo({ r: x });
      void recargar(true);
    } catch (e) { toast('No se pudo registrar', mensajeError(e), 'error'); }
  };

  const cobrarReserva = async (p: object) => {
    if (!cobrarR) return;
    try {
      const r = await cobro.post<{ ticket: Ticket }>('/cobros', { reservaId: Number(cobrarR.idReservacion), ...p });
      r.ticket.usuario = `${yo.nombre} ${yo.apellidos}`.trim();
      toast('Cobro registrado', `${cobrarR.nombreCliente} · ${cobrarR.clase}`);
      if (hallazgo) setHallazgo({ r: { ...hallazgo.r, estadoPago: 'pagado' } });
      setCobrarR(null); setTicket(r.ticket); void recargar(true);
    } catch (e) { toast('No se pudo cobrar', mensajeError(e), 'error'); }
  };
  const res = data?.res ?? [];
  const vivas = res.filter((r) => r.estatus !== 'cancelada');
  const porCobrar = vivas.filter((r) => r.estadoPago !== 'pagado' && r.precio > 0 && ['pend', 'conf'].includes(estadoDe(r)) && r.estadoCupo !== 'espera');
  const vendidas = data?.compras ?? [];
  const enEspera = vivas.filter((r) => r.estadoCupo === 'espera').length;
  const ahora = new Date();
  const ses = (data?.horarios ?? []).slice().sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  const minutos = (h: string) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  const nowMin = ahora.getHours() * 60 + ahora.getMinutes();
  const siguiente = ses.find((s) => minutos(s.horaInicio) > nowMin);

  const tarjetaReserva = (r: Reservacion) => {
    const e = estadoDe(r), porPagar = r.estadoPago !== 'pagado' && r.precio > 0 && (e === 'pend' || e === 'conf');
    const esHoy = r.fechaClase === hoyClave();
    return (
      <div className="nu-hit">
        <div className="rsum" style={{ paddingTop: 0 }}>
          <Avatar texto={iniciales(r.nombreCliente)} size={42} />
          <div><b>{r.nombreCliente}</b><small>Reservación <span className="rcode">{r.codigo}</span> · {r.origen === 'app' ? 'hecha en la app' : 'hecha en recepción'}</small></div>
          <div className="rline"><span><span className="cdot" style={{ background: colorClase(data?.clases ?? [], r.claseId || r.clase) }} /><b>{r.clase}</b></span>
            <span>{fechaCorta(r.fechaClase)} · <b>{hora12(horas(r.horaClase).ini)}</b></span><span>con {r.entrenador || 'Sin asignar'}</span>
            <span className={`pill st-${e}`}>{RST[e]}</span>
            <span>{r.estadoPago === 'pagado' ? (r.membresiaCompraId ? 'Cubierta con membresía' : 'Pagada') : r.precio > 0 ? <b style={{ color: 'var(--warn)' }}>Por pagar {money(r.precio)}</b> : 'Sin costo'}</span></div>
        </div>
        <div className="nu-hit-acts">
          {porPagar && r.estadoCupo !== 'espera' && <button className="btn acc" onClick={() => setCobrarR(r)}><Icon n="dinero" />Cobrar {money(r.precio)}</button>}
          {(e === 'pend' || e === 'conf') && esHoy && !porPagar && <button className="btn glass" onClick={() => asistencia(r)}><Icon n="on" />Registrar asistencia</button>}
          {!esHoy && (e === 'pend' || e === 'conf') && <span className="shint" style={{ margin: 0 }}>La asistencia se registra el día de la clase.</span>}
        </div>
      </div>
    );
  };

  const quick: [IconName, string, string, string][] = [
    ['reservaciones', 'Nueva reservación', 'Aparta un lugar para un cliente o visitante.', '/reservaciones'],
    ['personaMas', 'Registrar cliente', 'Alta con salud, tutor y documentos si es menor.', '/clientes'],
    ['membresias', 'Vender membresía', 'Cobra un paquete o membresía en el front desk.', '/membresias'],
    ['clases', 'Ver horarios', 'Agenda de clases y lugares disponibles.', '/clases'],
  ];

  return (
    <>
      <Kpis items={[
        { label: 'Ingresos de hoy', value: money(data?.kpis.ingresosHoy ?? 0), tono: 'accent', icon: 'dinero' },
        { label: 'Reservaciones de hoy', value: vivas.length, tono: 'blue', icon: 'reservaciones' },
        { label: 'Clases por cobrar hoy', value: porCobrar.length, tono: 'warn', icon: 'alerta' },
        { label: 'Membresías vendidas hoy', value: vendidas.length, tono: 'purple', icon: 'membresias' },
        { label: 'En lista de espera hoy', value: enEspera, tono: 'bad', icon: 'reloj' },
      ]} />
      {error && <ErrorBox mensaje={error} onRetry={recargar} />}

      <div className="nu-desk">
        <section className="dc">
          <div className="dsech"><h3 className="dih"><span className="si"><Icon n="codigo" /></span>Buscar por código</h3><span className="dcount">NU · por pagar  ·  PQ · con membresía</span></div>
          <p className="shint" style={{ margin: '0 0 12px' }}>Pide al cliente el código de su reservación (en la app o en su comprobante).</p>
          <form className="nu-codebar" onSubmit={(e) => { e.preventDefault(); void buscar(); }}>
            <input className="mono" value={codigo} onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setCodErr(''); }} placeholder="NU-12345 o PQ-12345" aria-label="Código de reservación" autoComplete="off" maxLength={8} />
            <button className="btn acc" disabled={buscando}>{buscando ? <span className="nu-spin" /> : <Icon n="buscar" />}Buscar</button>
          </form>
          {codErr && <div className="nu-error" style={{ marginTop: 12 }}><Icon n="alerta" /><span>{codErr}</span></div>}
          {hallazgo && tarjetaReserva(hallazgo.r)}
        </section>
        <section className="dc">
          <div className="dsech"><h3 className="dih"><span className="si"><Icon n="flechaDer" /></span>Accesos rápidos</h3></div>
          <div className="dquick" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
            {quick.map(([ic, t, d, to]) => (
              <button className="dq" key={t} onClick={() => nav(to)}><span className="qi"><Icon n={ic} /></span><span style={{ flex: 1 }}><b>{t}</b><small>{d}</small></span><span className="qa"><Icon n="flechaDer" /></span></button>
            ))}
          </div>
        </section>
      </div>

      <div className="sechrow" style={{ marginTop: 30 }}><h2 className="sech">Clases de hoy</h2><span className="clsub">{ses.length ? `${ses.length} sesiones` : ''}</span></div>
      {loading ? <Cargando /> : ses.length ? (
        <div className="dslots">
          {ses.map((s) => {
            const enCurso = minutos(s.horaInicio) <= nowMin && minutos(s.horaFin) > nowMin, pasada = minutos(s.horaFin) <= nowMin;
            const ocup = s.capacidadTotal - s.capacidadDisponible;
            return (
              <div key={s.idHorario} className={`dslot ${pasada ? 'past' : ''}`} style={{ ['--cc' as string]: colorClase(data?.clases ?? [], s.idClase) }}>
                <div className="top"><span className={`tag ${enCurso ? 'now' : s === siguiente ? 'next' : ''}`}>{enCurso ? 'En curso' : s === siguiente ? 'Siguiente' : pasada ? 'Terminó' : 'Programada'}</span><span className="hr">{hora12(s.horaInicio)}</span></div>
                <div className="bot"><b><span className="cdot" style={{ background: colorClase(data?.clases ?? [], s.idClase) }} />{s.nombreClase}</b><small>con {s.nombreEntrenador}</small>
                  <div className="barl"><span>{ocup} / {s.capacidadTotal} lugares</span></div>
                  <div className="bar"><i style={{ width: `${Math.min(100, (ocup / Math.max(1, s.capacidadTotal)) * 100)}%`, background: colorClase(data?.clases ?? [], s.idClase) }} /></div></div>
              </div>
            );
          })}
        </div>
      ) : <div className="dempty">Hoy no hay clases programadas.</div>}

      <div className="mvcols" style={{ marginTop: 30 }}>
        <div className="mvcol">
          <div className="mvch"><span className="mti sale">$</span><h3>Clases por cobrar hoy</h3><em>{porCobrar.length}</em></div>
          {porCobrar.length ? porCobrar.map((r) => (
            <div className="mvrow" key={r.idReservacion} style={{ gridTemplateColumns: '34px minmax(0,1fr) auto auto' }}>
              <Avatar texto={iniciales(r.nombreCliente)} size={34} />
              <div className="mvt"><b>{r.nombreCliente}</b><small><span className="rcode">{r.codigo}</span> · {r.clase} {hora12(horas(r.horaClase).ini)} · {r.origen === 'app' ? 'App' : 'Recepción'}</small></div>
              <div className="mvq">{money(r.precio)}</div>
              <IB icon="dinero" kind="mv" tip="Cobrar" onClick={() => setCobrarR(r)} />
            </div>
          )) : <div className="mvempty"><b>Todo cobrado</b><span>No hay clases pendientes de pago hoy.</span></div>}
        </div>
        <div className="mvcol">
          <div className="mvch"><span className="mti in" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>PQ</span><h3>Membresías vendidas hoy</h3><em>{vendidas.length}</em></div>
          {vendidas.length ? vendidas.slice(0, 10).map((c) => (
            <div className="mvrow" key={c.idCompra} style={{ gridTemplateColumns: '34px minmax(0,1fr) auto' }}>
              <Avatar texto={iniciales(c.nombreCliente)} size={34} />
              <div className="mvt"><b>{c.nombreCliente}</b><small><span className="rcode">{c.folio}</span> · {c.condiciones.nombre} · {optEntradas(c.condiciones.opcion)}</small></div>
              <div className="mvq">{money(c.precio)}</div>
            </div>
          )) : <div className="mvempty"><b>Sin ventas hoy</b><span>Aquí verás las membresías que se vendan en recepción.</span></div>}
        </div>
      </div>

      <div className="sechrow" style={{ marginTop: 30 }}><h2 className="sech">Llegadas de hoy</h2></div>
      <table className="rtab">
        <thead><tr><th>Horario</th><th>Cliente</th><th>Clase</th><th>Estatus</th><th className="r">Acciones</th></tr></thead>
        <tbody>{vivas.length ? vivas.sort((a, b) => a.horaClase.localeCompare(b.horaClase)).map((r) => {
          const e = estadoDe(r), porPagar = r.estadoPago !== 'pagado' && r.precio > 0 && (e === 'pend' || e === 'conf');
          return (
            <tr key={r.idReservacion} className="r">
              <td><div className="rtime"><b>{hora12(horas(r.horaClase).ini)}</b><small>a {hora12(horas(r.horaClase).fin)}</small></div></td>
              <td><div className="rcli"><Avatar texto={iniciales(r.nombreCliente)} /><div><b>{r.nombreCliente}</b><span className="rcode">{r.codigo}</span></div></div></td>
              <td><div className="rcls"><b><span className="cdot" style={{ background: colorClase(data?.clases ?? [], r.claseId || r.clase) }} />{r.clase}</b><small>con {r.entrenador}</small></div></td>
              <td><span className={`pill st-${e}`}>{RST[e]}</span>{porPagar && <span className="rgtag" style={{ color: 'var(--warn)' }}><Icon n="dinero" />Por pagar</span>}</td>
              <td><div className="acts">
                {porPagar && r.estadoCupo !== 'espera' && <IB icon="dinero" kind="mv" tip={`Cobrar ${money(r.precio)}`} onClick={() => setCobrarR(r)} />}
                <IB icon="on" kind="on" tip="Registrar asistencia" na={!(e === 'pend' || e === 'conf') ? 'Ya no está pendiente' : porPagar ? 'Primero cobra la clase' : r.estadoCupo === 'espera' ? 'Está en lista de espera' : ''} onClick={() => asistencia(r)} />
              </div></td>
            </tr>
          );
        }) : <tr className="emptyrow"><td colSpan={5}><b>Sin llegadas</b>No hay reservaciones para hoy.</td></tr>}</tbody>
      </table>

      <CobroDrawer open={!!cobrarR} onClose={() => setCobrarR(null)} titulo="Cobrar clase" sub={cobrarR?.codigo} total={cobrarR?.precio ?? 0} onCobrar={cobrarReserva}
        resumen={cobrarR && <div className="rsum" style={{ paddingTop: 0 }}><Avatar texto={iniciales(cobrarR.nombreCliente)} size={42} /><div><b>{cobrarR.nombreCliente}</b><small>Reservación <span className="rcode">{cobrarR.codigo}</span></small></div>
          <div className="rline"><span><b>{cobrarR.clase}</b></span><span>{fechaCorta(cobrarR.fechaClase)} · {hora12(horas(cobrarR.horaClase).ini)}</span></div></div>} />
      <TicketDialog ticket={ticket} onClose={() => setTicket(null)} />
    </>
  );
}
