import { useEffect, useMemo, useRef, useState } from 'react';
import { admin, mensajeError } from '../lib/api';
import { claveDia, deClave, DIA_LARGO, DOW, hora12, hoy, iniciales, MES, MES_LARGO, money, sumarDias } from '../lib/format';
import type { Usuario } from '../lib/session';
import { useSesion } from '../shell/AppShell';
import { Icon } from '../ui/Icon';
import { Cargando, Drawer, DrawerFooter, EmptyRow, ErrorBox, EstatusSeg, Field, Kpis, PillEstatus, SecHead, Switch, Tabs, useCarga, useFeedback } from '../ui/kit';

interface Clase { idClase: string; nombre: string; descripcion: string; capacidad: number; precio: number; color: string; estatus: 'activo' | 'inactivo' }
interface Sesion {
  idHorario: string; idClase: string; nombreClase: string; entrenadorId: string; nombreEntrenador: string; fecha: string; horaInicio: string; horaFin: string;
  capacidadTotal: number; capacidadDisponible: number; estatus: 'activo' | 'inactivo'; salon: string; idPlantilla?: string; origen?: 'manual' | 'plantilla';
  esExcepcionPlantilla?: boolean; visibleReservas?: boolean; listaEsperaHabilitada?: boolean;
}
interface Plantilla { idPlantilla: string; serieId?: string; idClase: string; diaSemana: number; horaInicio: string; horaFin: string; entrenadorId: string; vigenteDesde: string; vigenteHasta: string; estatus: string; visibleReservas: boolean; listaEsperaHabilitada: boolean; salon: string }

const COLORES: [string, string][] = [['#E8782F', 'Naranja'], ['#B9A3F5', 'Morado'], ['#8FB3FF', 'Azul'], ['#5BCB86', 'Verde'], ['#F5C542', 'Amarillo'], ['#F06363', 'Rojo']];
const HH = 84;
const HORAS = Array.from({ length: 35 }, (_, i) => { const m = 5 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; });
const aMin = (h: string) => { const [a, b] = h.split(':').map(Number); return a * 60 + (b || 0); };
const lunes = (d: Date) => sumarDias(d, -((d.getDay() + 6) % 7));
const rangoHora = (a: string, b: string) => `${hora12(a)} – ${hora12(b)}`;
const durTexto = (a: string, b: string) => { const m = aMin(b) - aMin(a); return m <= 0 ? '' : m % 60 ? `${Math.floor(m / 60) ? Math.floor(m / 60) + ' h ' : ''}${m % 60} min` : `${m / 60} h`; };

type Modo = 'week' | 'day' | 'list';
// GET /admin/api/horarios/resumen: indicadores de la semana actual (lunes a domingo)
interface Resumen { clasesActivas: number; sesionesHoy: number; sesionesSemana: number; ocupacionSemana: number; cambiosSemana: number }
interface ProgForm { unica: boolean; cls: string; coach: string; desde: string; ini: string; fin: string; dias: number[]; hasta: string; cap: string; vis: boolean; wait: boolean }
interface SesForm { s: Sesion; alcance: 'one' | 'next' | 'all'; coach: string; ini: string; fin: string; dias: number[]; vis: boolean; wait: boolean }

export default function Clases() {
  const yo = useSesion();
  const esAdmin = yo.rol === 'administrador';
  const { toast, confirmar } = useFeedback();
  const { data, setData, error, loading, recargar } = useCarga(async () => {
    const [clases, sesiones, plantillas, coaches, resumen] = await Promise.all([
      admin.get<Clase[]>('/clases'),
      admin.get<Sesion[]>('/horarios'),
      admin.get<Plantilla[]>('/plantillas-horarios').catch(() => [] as Plantilla[]),
      admin.get<Usuario[]>('/usuarios?rol=entrenador&estatus=activo').catch(() => [] as Usuario[]),
      admin.get<Resumen>('/horarios/resumen').catch(() => null),
    ]);
    return { clases, sesiones, plantillas, coaches, resumen };
  });
  const clases = data?.clases ?? [];
  const S = data?.sesiones ?? [];
  const coaches = data?.coaches ?? [];
  const [vista, setVista] = useState<'agenda' | 'cat' | 'cambios'>('agenda');
  const [modo, setModo] = useState<Modo>('week');
  const [semana, setSemana] = useState(lunes(hoy()));
  const [dia, setDia] = useState(hoy());
  const [clsF, setClsF] = useState('all');
  const [coachF, setCoachF] = useState('all');
  const [chF, setChF] = useState('all');
  const [prog, setProg] = useState<ProgForm | null>(null);
  const [alcance, setAlcance] = useState<Sesion | null>(null);
  const [ses, setSes] = useState<SesForm | null>(null);
  const [cc, setCc] = useState<{ edit?: Clase; nombre: string; desc: string; cap: string; precio: string; color: string; activo: boolean } | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const color = (id: string) => clases.find((c) => c.idClase === id)?.color || 'var(--accent)';
  const dias = modo === 'day' ? [dia] : Array.from({ length: 7 }, (_, k) => sumarDias(semana, k));
  const filt = (s: Sesion) => (clsF === 'all' || s.idClase === clsF) && (coachF === 'all' || s.entrenadorId === coachF);
  const porDia = (d: Date) => S.filter((s) => s.fecha === claveDia(d) && filt(s)).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  const enRango = dias.flatMap(porDia);
  const tipoCambio = (s: Sesion) => (s.estatus === 'inactivo' ? 'canc' : s.origen === 'manual' ? 'one' : s.esExcepcionPlantilla ? 'mov' : '');

  // Rango de horas visible
  const visibles = dias.flatMap(porDia);
  const H0 = Math.min(6, ...visibles.map((s) => Math.floor(aMin(s.horaInicio) / 60)));
  const H1 = Math.max(21, ...visibles.map((s) => Math.ceil(aMin(s.horaFin) / 60)));
  // Al cambiar de fecha, vista o modo, el calendario se muestra desde su primera hora.
  useEffect(() => {
    if (vista !== 'agenda' || modo === 'list' || !bodyRef.current) return;
    bodyRef.current.scrollTop = 0;
  }, [vista, modo, semana, dia, loading]);

  const hoyMs = new Date();
  // Indicadores: vienen del servidor; si el endpoint falla se calculan con las sesiones cargadas.
  const enSemana = (s: Sesion) => { const d = deClave(s.fecha); return d >= lunes(hoy()) && d < sumarDias(lunes(hoy()), 7); };
  const semanaActual = S.filter((s) => enSemana(s) && s.estatus === 'activo');
  const lugares = semanaActual.reduce((a, s) => a + s.capacidadTotal, 0);
  const ocupados = semanaActual.reduce((a, s) => a + (s.capacidadTotal - s.capacidadDisponible), 0);
  const R: Resumen = data?.resumen ?? {
    clasesActivas: clases.filter((c) => c.estatus === 'activo').length,
    sesionesHoy: semanaActual.filter((s) => s.fecha === claveDia(hoyMs)).length,
    sesionesSemana: semanaActual.length,
    ocupacionSemana: lugares ? Math.round((ocupados / lugares) * 100) : 0,
    cambiosSemana: S.filter((s) => enSemana(s) && (s.estatus === 'inactivo' || s.origen === 'manual' || s.esExcepcionPlantilla)).length,
  };

  /* ---------- programar / sesión única ---------- */
  const abrirProg = (unica: boolean) => {
    const c = clases.find((x) => x.estatus === 'activo');
    setProg({ unica, cls: c?.idClase ?? '', coach: '', desde: claveDia(new Date()), ini: '07:00', fin: '08:00', dias: [], hasta: '', cap: String(c?.capacidad ?? ''), vis: true, wait: false });
    setErrs({});
  };
  const guardarProg = async () => {
    if (!prog) return;
    const e: Record<string, string> = {};
    if (!prog.cls) e.cls = 'Elige una clase.';
    if (!prog.coach) e.coach = 'Elige un coach.';
    if (!prog.desde) e.desde = 'Elige una fecha.';
    if (aMin(prog.fin) <= aMin(prog.ini)) e.fin = 'La hora de fin debe ser posterior al inicio.';
    if (!prog.unica && !prog.dias.length) e.dias = 'Elige al menos un día.';
    if (!prog.unica && prog.hasta && prog.hasta < prog.desde) e.hasta = 'Debe ser después de la fecha de inicio.';
    if (prog.unica && !(Number(prog.cap) > 0)) e.cap = 'Escribe una capacidad mayor a 0.';
    setErrs(e);
    if (Object.keys(e).length) return;
    const clase = clases.find((c) => c.idClase === prog.cls)!, co = coaches.find((u) => u.idUsuario === prog.coach);
    setGuardando(true);
    try {
      if (prog.unica) {
        await admin.post('/horarios', {
          idClase: prog.cls, nombreClase: clase.nombre, entrenadorId: prog.coach, nombreEntrenador: co ? `${co.nombre} ${co.apellidos}` : '',
          fecha: prog.desde, horaInicio: prog.ini, horaFin: prog.fin, capacidadTotal: Number(prog.cap), salon: clase.nombre, estatus: 'activo',
          visibleReservas: prog.vis, listaEsperaHabilitada: prog.wait,
        });
        toast('Sesión creada', `${clase.nombre} el ${prog.desde} de ${rangoHora(prog.ini, prog.fin)}.`);
      } else {
        const r = await admin.post<{ mensaje: string; generacion: { sesionesCreadas: number } }>('/plantillas-horarios', {
          idClase: prog.cls, entrenadorId: prog.coach, salon: clase.nombre, fechaInicio: prog.desde, horaInicio: prog.ini, horaFin: prog.fin,
          diasSemana: [...prog.dias].sort(), ...(prog.hasta ? { fechaFin: prog.hasta } : {}), visibleReservas: prog.vis, listaEsperaHabilitada: prog.wait, estatus: 'activo',
        });
        toast('Clase programada', `${clase.nombre}: se crearon ${r.generacion?.sesionesCreadas ?? 0} sesiones.`);
      }
      setProg(null); void recargar(true);
    } catch (err) { toast('No se pudo programar', mensajeError(err), 'error'); }
    finally { setGuardando(false); }
  };

  /* ---------- editar sesión ---------- */
  const serieDe = (s: Sesion) => {
    const p = (data?.plantillas ?? []).find((x) => x.idPlantilla === s.idPlantilla);
    if (!p) return null;
    const id = p.serieId || p.idPlantilla;
    return { id, plantillas: (data?.plantillas ?? []).filter((x) => (x.serieId || x.idPlantilla) === id && x.estatus === 'activo') };
  };
  const abrirSesion = (s: Sesion) => {
    if (!esAdmin) return;
    if (s.origen === 'plantilla' && serieDe(s)) setAlcance(s);
    else abrirEdicion(s, 'one');
  };
  const abrirEdicion = (s: Sesion, a: SesForm['alcance']) => {
    setAlcance(null);
    const serie = serieDe(s);
    setSes({ s, alcance: a, coach: s.entrenadorId, ini: s.horaInicio, fin: s.horaFin, dias: serie ? [...new Set(serie.plantillas.map((p) => p.diaSemana))] : [deClave(s.fecha).getDay()], vis: s.visibleReservas !== false, wait: !!s.listaEsperaHabilitada });
    setErrs({});
  };
  const guardarSesion = async () => {
    if (!ses) return;
    const e: Record<string, string> = {};
    if (!ses.coach) e.coach = 'Elige un coach.';
    if (aMin(ses.fin) <= aMin(ses.ini)) e.fin = 'La hora de fin debe ser posterior al inicio.';
    if (ses.alcance !== 'one' && !ses.dias.length) e.dias = 'Elige al menos un día.';
    setErrs(e);
    if (Object.keys(e).length) return;
    const s = ses.s;
    setGuardando(true);
    try {
      if (ses.alcance === 'one') {
        if (s.origen === 'plantilla') {
          await admin.patch(`/horarios/${s.idHorario}/excepcion`, { entrenadorId: ses.coach, salon: s.salon, horaInicio: ses.ini, horaFin: ses.fin, estatus: s.estatus, visibleReservas: ses.vis, listaEsperaHabilitada: ses.wait });
        } else {
          const co = coaches.find((u) => u.idUsuario === ses.coach);
          await admin.patch(`/horarios/${s.idHorario}`, { idClase: s.idClase, nombreClase: s.nombreClase, entrenadorId: ses.coach, nombreEntrenador: co ? `${co.nombre} ${co.apellidos}` : s.nombreEntrenador, fecha: s.fecha, horaInicio: ses.ini, horaFin: ses.fin, capacidadTotal: s.capacidadTotal, salon: s.salon, estatus: s.estatus, visibleReservas: ses.vis, listaEsperaHabilitada: ses.wait });
        }
        toast('Sesión actualizada', `${s.nombreClase} del ${s.fecha}. Las demás semanas no cambian.`);
      } else {
        const serie = serieDe(s)!;
        const r = await admin.patch<{ mensaje: string; sesionesProtegidas?: number }>(`/plantillas-horarios/series/${serie.id}`, {
          idClase: s.idClase, entrenadorId: ses.coach, salon: s.salon, horaInicio: ses.ini, horaFin: ses.fin, diasSemana: [...ses.dias].sort(),
          aplicarDesde: ses.alcance === 'next' ? s.fecha : claveDia(new Date()), visibleReservas: ses.vis, listaEsperaHabilitada: ses.wait,
        });
        toast('Programación actualizada', r.sesionesProtegidas ? `${r.mensaje} ${r.sesionesProtegidas} sesiones con reservaciones se conservaron.` : r.mensaje);
      }
      setSes(null); void recargar(true);
    } catch (err) { toast('No se pudo guardar', mensajeError(err), 'error'); }
    finally { setGuardando(false); }
  };
  const cancelarSesion = async () => {
    if (!ses) return;
    const s = ses.s, ocup = s.capacidadTotal - s.capacidadDisponible;
    if (!(await confirmar({ t: `¿Cancelar ${s.nombreClase} del ${s.fecha}?`, p: ocup ? `Tiene ${ocup} reservaciones. Avísales a los clientes; las reservaciones se conservan para que recepción las atienda.` : 'Solo se cancela esta sesión; las demás semanas no cambian.', y: 'Sí, cancelar sesión', n: 'No, mantenerla' }))) return;
    try {
      if (s.origen === 'plantilla') await admin.patch(`/horarios/${s.idHorario}/excepcion`, { entrenadorId: s.entrenadorId, salon: s.salon, horaInicio: s.horaInicio, horaFin: s.horaFin, estatus: 'inactivo', visibleReservas: s.visibleReservas !== false, listaEsperaHabilitada: !!s.listaEsperaHabilitada });
      else await admin.patch(`/horarios/${s.idHorario}`, { ...s, estatus: 'inactivo' });
      setSes(null); toast('Sesión cancelada', `${s.nombreClase} del ${s.fecha} ya no está disponible.`); void recargar(true);
    } catch (err) { toast('No se pudo cancelar', mensajeError(err), 'error'); }
  };

  /* ---------- catálogo ---------- */
  const abrirClase = (c?: Clase) => { setCc(c ? { edit: c, nombre: c.nombre, desc: c.descripcion, cap: String(c.capacidad), precio: String(c.precio), color: c.color, activo: c.estatus === 'activo' } : { nombre: '', desc: '', cap: '', precio: '', color: COLORES[0][0], activo: true }); setErrs({}); };
  const guardarClase = async () => {
    if (!cc) return;
    const e: Record<string, string> = {};
    if (!cc.nombre.trim()) e.nombre = 'Escribe el nombre.';
    else if (clases.some((c) => c.nombre.toLowerCase() === cc.nombre.trim().toLowerCase() && c.idClase !== cc.edit?.idClase)) e.nombre = 'Ya existe una clase con este nombre.';
    if (!(Number(cc.cap) > 0)) e.cap = 'Mayor a 0.';
    if (cc.precio === '' || Number(cc.precio) < 0) e.precio = 'Escribe un precio.';
    setErrs(e);
    if (Object.keys(e).length) return;
    const cuerpo = { nombre: cc.nombre.trim(), descripcion: cc.desc.trim(), capacidad: Number(cc.cap), precio: Number(cc.precio), color: cc.color, estatus: cc.activo ? 'activo' : 'inactivo' };
    setGuardando(true);
    try {
      const r = cc.edit ? await admin.patch<Clase>(`/clases/${cc.edit.idClase}`, cuerpo) : await admin.post<Clase>('/clases', cuerpo);
      setData((d) => d && { ...d, clases: cc.edit ? d.clases.map((x) => (x.idClase === r.idClase ? r : x)) : [...d.clases, r] });
      toast(cc.edit ? 'Cambios guardados' : 'Clase agregada', cc.edit ? `Actualizamos ${r.nombre}.` : `${r.nombre} ya está en el catálogo.`);
      setCc(null);
    } catch (err) { toast('No se pudo guardar', mensajeError(err), 'error'); }
    finally { setGuardando(false); }
  };
  const alternarClase = async (c: Clase) => {
    const activar = c.estatus !== 'activo';
    if (!(await confirmar(activar ? { t: `¿Reactivar ${c.nombre}?`, p: 'Podrás volver a programarla.', y: 'Sí, reactivar', tono: 'ok' } : { t: `¿Desactivar ${c.nombre}?`, p: 'Ya no se podrá programar ni reservar. Su historial se conserva.', y: 'Sí, desactivar', n: 'No, mantenerla' }))) return;
    try {
      const r = await admin.patch<Clase>(`/clases/${c.idClase}`, { estatus: activar ? 'activo' : 'inactivo' });
      setData((d) => d && { ...d, clases: d.clases.map((x) => (x.idClase === r.idClase ? r : x)) });
      toast(activar ? 'Clase reactivada' : 'Clase desactivada', r.nombre);
    } catch (err) { toast('No se pudo actualizar', mensajeError(err), 'error'); }
  };

  const titulo = modo === 'day'
    ? `${DIA_LARGO[dia.getDay()].replace(/^./, (x) => x.toUpperCase())} ${dia.getDate()} de ${MES_LARGO[dia.getMonth()]} ${dia.getFullYear()}`
    : dias[0].getMonth() === dias[6].getMonth() ? `${dias[0].getDate()} – ${dias[6].getDate()} de ${MES_LARGO[dias[6].getMonth()]} ${dias[6].getFullYear()}`
      : `${dias[0].getDate()} ${MES[dias[0].getMonth()]} – ${dias[6].getDate()} ${MES[dias[6].getMonth()]} ${dias[6].getFullYear()}`;
  const mover = (k: number) => { if (modo === 'day') setDia(sumarDias(dia, k)); else setSemana(sumarDias(semana, 7 * k)); };

  const cambios = useMemo(() => S.filter((s) => tipoCambio(s) && deClave(s.fecha) >= sumarDias(hoy(), -30)).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [S]);
  const CHT: Record<string, [string, string]> = { canc: ['Cancelada', 'ch-canc'], mov: ['Horario movido', 'ch-mov'], coa: ['Cambio de coach', 'ch-coa'], one: ['Sesión única', 'ch-one'], pro: ['Programación', 'ch-pro'] };
  const diasBtns = (val: number[], set: (d: number[]) => void) => (
    <div className="wdays">{[1, 2, 3, 4, 5, 6, 0].map((w) => <button type="button" key={w} className={val.includes(w) ? 'on' : ''} onClick={() => set(val.includes(w) ? val.filter((x) => x !== w) : [...val, w])}>{DOW[w]}</button>)}</div>
  );

  return (
    <>
      <Kpis items={[
        { label: 'Clases activas', value: R.clasesActivas, tono: 'ok', icon: 'pesa' },
        { label: 'Sesiones hoy', value: R.sesionesHoy, tono: 'accent', icon: 'reloj' },
        { label: 'Sesiones esta semana', value: R.sesionesSemana, tono: 'blue', icon: 'semana' },
        { label: 'Ocupación de la semana', value: `${R.ocupacionSemana}%`, tono: 'purple', icon: 'grupo' },
        { label: 'Cambios esta semana', value: R.cambiosSemana, tono: 'warn', icon: 'cambios' },
      ]} />
      <div className="vsw" role="tablist">
        <button role="tab" className={vista === 'agenda' ? 'on' : ''} onClick={() => setVista('agenda')}><b>Agenda</b><small>Consulta y administra las sesiones programadas por fecha.</small></button>
        <button role="tab" className={vista === 'cat' ? 'on' : ''} onClick={() => setVista('cat')}><b>Catálogo de clases</b><small>Tipos de clase, capacidad, precio y color.</small></button>
        <button role="tab" className={vista === 'cambios' ? 'on' : ''} onClick={() => setVista('cambios')}><b>Cambios y excepciones</b><small>Sesiones movidas, canceladas o agregadas de forma especial.</small></button>
      </div>
      {error && <ErrorBox mensaje={error} onRetry={recargar} />}

      {vista === 'agenda' && (
        <div className="clpane">
          <SecHead title={titulo}>
            <div className="wnav">
              <button className="ib" onClick={() => mover(-1)} aria-label="Anterior" data-tip="Anterior"><Icon n="chevL" w={2.2} /></button>
              <button className="btn line sm" onClick={() => { setSemana(lunes(hoy())); setDia(hoy()); }}>Hoy</button>
              <button className="ib" onClick={() => mover(1)} aria-label="Siguiente" data-tip="Siguiente"><Icon n="chevR" w={2.2} /></button>
            </div>
            {esAdmin && <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
              <button className="btn glass" onClick={() => abrirProg(true)}><Icon n="sesion" />Sesión única</button>
              <button className="btn acc" onClick={() => abrirProg(false)}><Icon n="mas" w={2.4} />Programar clase</button>
            </div>}
          </SecHead>
          <div className="tabrow">
            <Tabs value={clsF} onChange={setClsF} tabs={[['all', 'Todas', enRango.filter((s) => s.estatus === 'activo').length], ...clases.filter((c) => c.estatus === 'activo').map((c) => [c.idClase, c.nombre, enRango.filter((s) => s.idClase === c.idClase && s.estatus === 'activo').length] as [string, string, number])]} />
            <label className="selsm"><span>Coach</span><select value={coachF} onChange={(e) => setCoachF(e.target.value)} aria-label="Filtrar por coach">
              <option value="all">Todos</option>{coaches.map((c) => <option key={c.idUsuario} value={c.idUsuario}>{c.nombre} {c.apellidos}</option>)}</select></label>
            <div className="per" style={{ marginLeft: 'auto', borderLeft: 'none', paddingLeft: 0 }}>
              {([['week', 'Semana'], ['day', 'Día'], ['list', 'Lista']] as [Modo, string][]).map(([k, l]) => <button key={k} className={modo === k ? 'on' : ''} onClick={() => { setModo(k); if (k !== 'day') setSemana(lunes(dia)); }}>{l}</button>)}
            </div>
          </div>
          {loading ? <Cargando /> : modo === 'list' ? (
            <table>
              <thead><tr><th>Horario</th><th>Clase</th><th>Coach</th><th>Ocupación</th><th>Estatus</th>{esAdmin && <th className="r">Acciones</th>}</tr></thead>
              <tbody>
                {dias.some((d) => porDia(d).length) ? dias.flatMap((d) => {
                  const L = porDia(d);
                  if (!L.length) return [];
                  const td = claveDia(d) === claveDia(hoyMs);
                  return [<tr className="hday" key={'h' + claveDia(d)}><td colSpan={6}>{td ? 'Hoy' : `${DIA_LARGO[d.getDay()]}, ${d.getDate()} de ${MES_LARGO[d.getMonth()]}`}<em>{L.filter((s) => s.estatus === 'activo').length} sesiones</em></td></tr>,
                  ...L.map((s) => {
                    const st = deClave(s.fecha), en = deClave(s.fecha); st.setHours(0, aMin(s.horaInicio)); en.setHours(0, aMin(s.horaFin));
                    const canc = s.estatus === 'inactivo', t = s.capacidadTotal - s.capacidadDisponible;
                    return (
                      <tr className={`r ${canc ? 'inact' : ''}`} key={s.idHorario}>
                        <td><div className="rtime"><b>{hora12(s.horaInicio)}</b><small>a {hora12(s.horaFin)}</small></div></td>
                        <td><b className="dtc"><span className="cdot" style={{ background: color(s.idClase) }} />{s.nombreClase}</b>{s.origen === 'manual' ? <span className="pill ch-one" style={{ marginLeft: 6 }}>Única</span> : s.esExcepcionPlantilla && !canc ? <span className="pill ch-ser" style={{ marginLeft: 6 }}>Cambio</span> : null}</td>
                        <td><div className="huser"><span className="av">{iniciales(s.nombreEntrenador)}</span>{s.nombreEntrenador}</div></td>
                        <td>{canc ? <span className="none">—</span> : <div className="docc"><div className="bar"><i style={{ width: `${Math.min(100, (t / Math.max(1, s.capacidadTotal)) * 100)}%`, background: color(s.idClase) }} /></div><span>{t} / {s.capacidadTotal}</span></div>}</td>
                        <td>{canc ? <span className="pill st-canc">Cancelada</span> : en <= hoyMs ? <span className="pill st-pend">Terminó</span> : st <= hoyMs ? <span className="pill st-asis">En curso</span> : <span className="pill st-conf">Programada</span>}</td>
                        {esAdmin && <td><div className="acts"><button className="ib" data-tip="Editar sesión" aria-label={`Editar ${s.nombreClase}`} onClick={() => abrirSesion(s)}><Icon n="editar" /></button></div></td>}
                      </tr>
                    );
                  })];
                }) : <EmptyRow cols={6} title="Sin clases en este periodo" text="Programa una clase o cambia los filtros." />}
              </tbody>
            </table>
          ) : (
            <div className="cal">
              <div className="calh" style={{ gridTemplateColumns: `78px repeat(${dias.length},minmax(0,1fr))` }}>
                <div />
                {dias.map((d) => { const n = porDia(d).filter((s) => s.estatus === 'activo').length; return (
                  <div key={claveDia(d)} className={claveDia(d) === claveDia(hoyMs) ? 'td' : ''}><small>{DOW[d.getDay()]}</small><b>{d.getDate()}</b><span className="cnt">{n ? `${n} sesi${n === 1 ? 'ón' : 'ones'}` : 'Sin clases'}</span></div>); })}
              </div>
              <div className="calb" ref={bodyRef} style={{ gridTemplateColumns: `78px repeat(${dias.length},minmax(0,1fr))`, ['--hh' as string]: `${HH}px` }}>
                <div className="calt" style={{ height: (H1 - H0) * HH }}>{Array.from({ length: H1 - H0 }, (_, i) => <span key={i} style={{ top: i * HH + (i ? 0 : 8) }}>{hora12(`${H0 + i}:00`)}</span>)}</div>
                {dias.map((d) => {
                  const L = porDia(d), td = claveDia(d) === claveDia(hoyMs);
                  const lanes: Sesion[][] = [];
                  const laneDe = new Map<string, number>();
                  L.forEach((x) => { let i = 0; while (lanes[i]?.some((y) => aMin(x.horaInicio) < aMin(y.horaFin) && aMin(y.horaInicio) < aMin(x.horaFin))) i++; (lanes[i] ??= []).push(x); laneDe.set(x.idHorario, i); });
                  const ahoraMin = hoyMs.getHours() * 60 + hoyMs.getMinutes();
                  return (
                    <div key={claveDia(d)} className={`calc ${td ? 'td' : ''} ${d.getDay() === 0 ? 'sun' : ''}`} style={{ height: (H1 - H0) * HH }}>
                      {L.map((x) => {
                        const n = L.filter((y) => aMin(x.horaInicio) < aMin(y.horaFin) && aMin(y.horaInicio) < aMin(x.horaFin)).reduce((m, y) => Math.max(m, (laneDe.get(y.idHorario) ?? 0) + 1), 1);
                        const w = 100 / n, lane = laneDe.get(x.idHorario) ?? 0;
                        const fin = deClave(x.fecha); fin.setHours(0, aMin(x.horaFin));
                        const canc = x.estatus === 'inactivo', tc = tipoCambio(x);
                        return (
                          <button key={x.idHorario} className={`ev ${fin < hoyMs ? 'past' : ''} ${canc ? 'canc' : ''} ${x.visibleReservas === false ? 'hid' : ''}`} onClick={() => abrirSesion(x)}
                            style={{ ['--cc' as string]: color(x.idClase), top: ((aMin(x.horaInicio) - H0 * 60) / 60) * HH + 2, height: ((aMin(x.horaFin) - aMin(x.horaInicio)) / 60) * HH - 4, left: `calc(${lane * w}% + 4px)`, right: 'auto', width: `calc(${w}% - 8px)`, cursor: esAdmin ? 'pointer' : 'default' }}
                            aria-label={`${x.nombreClase} ${hora12(x.horaInicio)}`}>
                            <b>{x.nombreClase}{canc ? <span className="xtag">Cancelada</span> : tc === 'one' ? <span className="xtag" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>Única</span> : tc === 'mov' ? <span className="xtag">Cambio</span> : null}</b>
                            <small>{rangoHora(x.horaInicio, x.horaFin)}</small>
                            <small className="evc"><span>{x.nombreEntrenador}</span>{!canc && <i>{x.capacidadTotal - x.capacidadDisponible}/{x.capacidadTotal}</i>}</small>
                          </button>
                        );
                      })}
                      {td && ahoraMin >= H0 * 60 && ahoraMin <= H1 * 60 && <div className="nowl" style={{ top: ((ahoraMin - H0 * 60) / 60) * HH }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {modo !== 'list' && !dias.some((d) => porDia(d).length) && <div className="calempty"><b>Sin clases en este periodo</b>{esAdmin ? 'Programa una clase o cambia los filtros.' : 'Cambia los filtros o la semana.'}</div>}
        </div>
      )}

      {vista === 'cat' && (
        <div className="clpane">
          <SecHead title="Catálogo de clases"><span className="clsub">{clases.filter((c) => c.estatus === 'activo').length} activas · el coach se asigna al programar</span></SecHead>
          <div className="ccgrid">
            {clases.map((c) => (
              <div key={c.idClase} className={`ccard ${c.estatus === 'activo' ? '' : 'off'}`} style={{ ['--cc' as string]: c.color || 'var(--accent)' }}>
                <div className="band" />
                <div className="cin">
                  <div className="ch"><span className="ci"><Icon n="pesa" /></span><div><h4>{c.nombre}</h4><PillEstatus activo={c.estatus === 'activo'} f /></div></div>
                  <div className="cd">{c.descripcion || 'Sin descripción'}</div>
                  <div className="cst"><div><b>{c.capacidad}</b><small>Lugares</small></div><div><b>{c.precio ? money(c.precio) : 'Gratis'}</b><small>Por clase</small></div>
                    <div><b>{S.filter((s) => s.idClase === c.idClase && s.estatus === 'activo' && deClave(s.fecha) >= lunes(hoy()) && deClave(s.fecha) < sumarDias(lunes(hoy()), 7)).length}</b><small>Esta semana</small></div></div>
                  {esAdmin && <div className="cbt"><button className="btn glass" onClick={() => abrirClase(c)}><Icon n="editar" />Editar</button>
                    {c.estatus === 'activo' ? <button className="btn cancel out" onClick={() => alternarClase(c)}>Desactivar</button> : <button className="btn ok2" onClick={() => alternarClase(c)}>Reactivar</button>}</div>}
                </div>
              </div>
            ))}
            {esAdmin && <button className="ccadd" onClick={() => abrirClase()}><span className="mplus"><Icon n="mas" w={2.2} /></span><b>Nueva clase</b><small>Agregar un tipo de clase al catálogo</small></button>}
          </div>
        </div>
      )}

      {vista === 'cambios' && (
        <div className="clpane">
          <SecHead title="Cambios y excepciones" />
          <div className="tabrow"><Tabs value={chF} onChange={setChF} tabs={[['all', 'Todos', cambios.length], ...Object.entries(CHT).map(([k, v]) => [k, v[0], cambios.filter((s) => tipoCambio(s) === k).length] as [string, string, number])]} /></div>
          <table>
            <thead><tr><th>Sesión</th><th>Clase</th><th>Cambio</th><th>Detalle</th><th>Registró</th>{esAdmin && <th className="r">Acciones</th>}</tr></thead>
            <tbody>
              {cambios.filter((s) => chF === 'all' || tipoCambio(s) === chF).map((s) => {
                const d = deClave(s.fecha), t = CHT[tipoCambio(s)];
                return (
                  <tr className="r" key={s.idHorario}>
                    <td><div className="rtime"><b>{DOW[d.getDay()]} {d.getDate()} {MES[d.getMonth()]}</b><small>{rangoHora(s.horaInicio, s.horaFin)}</small></div></td>
                    <td><b className="dtc"><span className="cdot" style={{ background: color(s.idClase) }} />{s.nombreClase}</b></td>
                    <td><span className={`pill ${t[1]}`}>{t[0]}</span></td>
                    <td className="fade">con {s.nombreEntrenador} · {s.capacidadTotal - s.capacidadDisponible}/{s.capacidadTotal} reservados</td>
                    <td>{""}</td>
                    {esAdmin && <td><div className="acts">{s.estatus === 'activo' && <button className="ib" data-tip="Editar sesión" aria-label="Editar sesión" onClick={() => abrirEdicion(s, 'one')}><Icon n="editar" /></button>}</div></td>}
                  </tr>
                );
              })}
              {!cambios.filter((s) => chF === 'all' || tipoCambio(s) === chF).length && <EmptyRow cols={5} title="Sin cambios" text="Aquí verás las sesiones movidas, canceladas o agregadas." />}
            </tbody>
          </table>
        </div>
      )}

      {/* Programar clase / sesión única */}
      <Drawer open={!!prog} onClose={() => setProg(null)} onSubmit={guardarProg} title={prog?.unica ? 'Sesión única' : 'Programar clase'} sub={prog?.unica ? 'Agrega una clase en una sola fecha.' : 'Crea un horario que se repite cada semana.'}
        footer={<DrawerFooter label={prog?.unica ? 'Crear sesión' : 'Programar clase'} onSave={guardarProg} onCancel={() => setProg(null)} saving={guardando} />}>
        {prog && <>
          <div className="lbl">Clase y coach</div>
          <div className="sbox">
            <Field label="Clase" req error={errs.cls}><div className="catpick">{clases.filter((c) => c.estatus === 'activo').map((c) => (
              <button type="button" key={c.idClase} className={prog.cls === c.idClase ? 'on' : ''} onClick={() => setProg({ ...prog, cls: c.idClase, cap: String(c.capacidad) })}><span className="cdot" style={{ background: c.color }} />{c.nombre}</button>))}</div></Field>
            <Field label="Coach" req last error={errs.coach}><select className="sel" value={prog.coach} onChange={(e) => setProg({ ...prog, coach: e.target.value })}>
              <option value="">Elige un coach</option>{coaches.map((c) => <option key={c.idUsuario} value={c.idUsuario}>{c.nombre} {c.apellidos}</option>)}</select></Field>
          </div>
          <div className="lbl">Fecha y horario</div>
          <div className="sbox">
            <Field label={prog.unica ? 'Fecha' : 'Empieza el'} req error={errs.desde}><input type="date" min={claveDia(new Date())} value={prog.desde} onChange={(e) => setProg({ ...prog, desde: e.target.value })} /></Field>
            <div className="frow2">
              <Field label="Hora de inicio" req><select className="sel" value={prog.ini} onChange={(e) => setProg({ ...prog, ini: e.target.value })}>{HORAS.map((h) => <option key={h} value={h}>{hora12(h)}</option>)}</select></Field>
              <Field label="Hora de fin" req error={errs.fin}><select className="sel" value={prog.fin} onChange={(e) => setProg({ ...prog, fin: e.target.value })}>{HORAS.map((h) => <option key={h} value={h}>{hora12(h)}</option>)}</select></Field>
            </div>
            <div className={`durbox ${aMin(prog.fin) <= aMin(prog.ini) ? 'bad' : ''}`}><span>Duración</span><b>{durTexto(prog.ini, prog.fin) || 'Revisa las horas'}</b></div>
            {!prog.unica ? <>
              <Field label="Se repite los" req error={errs.dias}>{diasBtns(prog.dias, (d) => setProg({ ...prog, dias: d }))}
                <div className="qlinks"><button type="button" onClick={() => setProg({ ...prog, dias: [1, 2, 3, 4, 5] })}>Lunes a viernes</button><button type="button" onClick={() => setProg({ ...prog, dias: [0, 1, 2, 3, 4, 5, 6] })}>Todos los días</button><button type="button" onClick={() => setProg({ ...prog, dias: [] })}>Quitar todos</button></div></Field>
              <Field label="Termina el" opt last error={errs.hasta} hint="Sin fecha final, el horario se repite indefinidamente."><input type="date" min={prog.desde} value={prog.hasta} onChange={(e) => setProg({ ...prog, hasta: e.target.value })} /></Field>
            </> : <Field label="Capacidad" req last error={errs.cap}><div className="unitw"><input inputMode="numeric" value={prog.cap} onChange={(e) => setProg({ ...prog, cap: e.target.value.replace(/\D/g, '') })} /><span>lugares</span></div></Field>}
          </div>
          <div className="lbl">Reservaciones</div>
          <div className="sbox" style={{ paddingBottom: 6 }}>
            <label className="swrow"><span><b>Visible para reservaciones</b><small>Los clientes pueden reservarla desde la app y en recepción.</small></span><Switch bare checked={prog.vis} onChange={(v) => setProg({ ...prog, vis: v })} /></label>
            <label className="swrow"><span><b>Lista de espera</b><small>Permite anotarse cuando la clase se llene.</small></span><Switch bare checked={prog.wait} onChange={(v) => setProg({ ...prog, wait: v })} /></label>
          </div>
        </>}
      </Drawer>

      {/* ¿Qué deseas editar? */}
      <div className={`dlg-veil ${alcance ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setAlcance(null); }}>
        {alcance && <div className="dlg scdlg" role="dialog" aria-label="¿Qué deseas editar?">
          <button className="x scx" onClick={() => setAlcance(null)} aria-label="Cerrar"><Icon n="x" w={2.2} /></button>
          <h5>¿Qué deseas editar?</h5>
          <div className="sesum"><b><span className="cdot" style={{ background: color(alcance.idClase) }} />{alcance.nombreClase}</b><small>{alcance.fecha} · {rangoHora(alcance.horaInicio, alcance.horaFin)} · con {alcance.nombreEntrenador}</small></div>
          <button className="scopt" onClick={() => abrirEdicion(alcance, 'one')}><b>Solo esta sesión</b><small>Se guarda como excepción; las demás semanas no cambian.</small></button>
          <button className="scopt" onClick={() => abrirEdicion(alcance, 'next')}><b>Esta sesión y las siguientes</b><small>La programación cambia desde el {alcance.fecha}.</small></button>
          <button className="scopt" onClick={() => abrirEdicion(alcance, 'all')}><b>Toda la programación</b><small>Cambia todas las sesiones futuras de este horario. Las pasadas se conservan.</small></button>
        </div>}
      </div>

      {/* Editar sesión */}
      <Drawer open={!!ses} onClose={() => setSes(null)} onSubmit={guardarSesion} title="Editar sesión"
        sub={ses ? (ses.alcance === 'one' ? 'Solo esta sesión' : ses.alcance === 'next' ? 'Esta sesión y las siguientes' : 'Toda la programación') : ''}
        footer={<DrawerFooter label="Guardar cambios" onSave={guardarSesion} onCancel={() => setSes(null)} saving={guardando} />}>
        {ses && <>
          <div className="sesum"><b><span className="cdot" style={{ background: color(ses.s.idClase) }} />{ses.s.nombreClase}</b><small>{ses.s.fecha} · {rangoHora(ses.s.horaInicio, ses.s.horaFin)} · {ses.s.capacidadTotal - ses.s.capacidadDisponible} de {ses.s.capacidadTotal} lugares reservados</small>
            {ses.alcance !== 'one' && <span className="sct">Las sesiones con reservaciones se conservan sin cambios</span>}</div>
          <div className="lbl">Coach y horario</div>
          <div className="sbox">
            <Field label="Coach" req error={errs.coach}><select className="sel" value={ses.coach} onChange={(e) => setSes({ ...ses, coach: e.target.value })}>
              <option value="">Elige un coach</option>{coaches.map((c) => <option key={c.idUsuario} value={c.idUsuario}>{c.nombre} {c.apellidos}</option>)}</select></Field>
            <div className="frow2">
              <Field label="Hora de inicio" req last><select className="sel" value={ses.ini} onChange={(e) => setSes({ ...ses, ini: e.target.value })}>{[...new Set([ses.ini, ...HORAS])].sort().map((h) => <option key={h} value={h}>{hora12(h)}</option>)}</select></Field>
              <Field label="Hora de fin" req last error={errs.fin}><select className="sel" value={ses.fin} onChange={(e) => setSes({ ...ses, fin: e.target.value })}>{[...new Set([ses.fin, ...HORAS])].sort().map((h) => <option key={h} value={h}>{hora12(h)}</option>)}</select></Field>
            </div>
            {ses.alcance !== 'one' && <Field label="Se repite los" req last error={errs.dias} style={{ marginTop: 4 }}>{diasBtns(ses.dias, (d) => setSes({ ...ses, dias: d }))}</Field>}
          </div>
          <div className="lbl">Reservaciones</div>
          <div className="sbox" style={{ paddingBottom: 6 }}>
            <label className="swrow"><span><b>Visible para reservaciones</b><small>Los clientes pueden reservarla desde la app y en recepción.</small></span><Switch bare checked={ses.vis} onChange={(v) => setSes({ ...ses, vis: v })} /></label>
            <label className="swrow"><span><b>Lista de espera</b><small>Permite anotarse cuando la clase se llene.</small></span><Switch bare checked={ses.wait} onChange={(v) => setSes({ ...ses, wait: v })} /></label>
          </div>
          {ses.s.estatus === 'activo' && <button type="button" className="btn cancel out" style={{ width: '100%' }} onClick={cancelarSesion}>Cancelar esta sesión</button>}
        </>}
      </Drawer>

      {/* Clase del catálogo */}
      <Drawer open={!!cc} onClose={() => setCc(null)} onSubmit={guardarClase} title={cc?.edit ? 'Editar clase' : 'Nueva clase'} sub={cc?.edit ? cc.edit.nombre : 'Agrega un tipo de clase al catálogo.'}
        footer={<DrawerFooter label={cc?.edit ? 'Guardar cambios' : 'Agregar clase'} onSave={guardarClase} onCancel={() => setCc(null)} saving={guardando} />}>
        {cc && <>
          <div className="lbl">Datos de la clase</div>
          <div className="sbox">
            <Field label="Nombre de la clase" req error={errs.nombre}><input placeholder="Ej. Force Room" value={cc.nombre} onChange={(e) => setCc({ ...cc, nombre: e.target.value })} /></Field>
            <Field label="Descripción" opt last><textarea rows={2} placeholder="Ej. Fuerza · resistencia · potencia" value={cc.desc} onChange={(e) => setCc({ ...cc, desc: e.target.value })} /></Field>
          </div>
          <div className="lbl">Capacidad y precio</div>
          <div className="sbox">
            <div className="frow2">
              <Field label="Capacidad" req error={errs.cap}><div className="unitw"><input inputMode="numeric" placeholder="12" value={cc.cap} onChange={(e) => setCc({ ...cc, cap: e.target.value.replace(/\D/g, '') })} /><span>lugares</span></div></Field>
              <Field label="Precio por clase" req error={errs.precio}><div className="money big"><span>$</span><input inputMode="decimal" placeholder="0" value={cc.precio} onChange={(e) => setCc({ ...cc, precio: e.target.value.replace(/[^\d.]/g, '') })} /></div></Field>
            </div>
            <div className="hint" style={{ margin: '-6px 0 14px' }}>El coach se asigna al programar la clase o en cada sesión. Precio $0 = clase sin costo.</div>
          </div>
          <div className="lbl">Color identificador</div>
          <div className="sbox"><div className="swatches">{COLORES.map(([c, n]) => <button type="button" key={c} aria-label={n} title={n} className={cc.color === c ? 'on' : ''} style={{ ['--c' as string]: c }} onClick={() => setCc({ ...cc, color: c })} />)}</div>
            <div className="hint" style={{ margin: '10px 0 14px' }}>Se usa en la agenda, reservaciones y el Dashboard.</div></div>
          <div className="lbl">Estatus</div>
          <div className="sbox stsb"><EstatusSeg f activo={cc.activo} onChange={(v) => setCc({ ...cc, activo: v })}
            textoOn={<><b style={{ color: 'var(--ink)' }}>Se puede programar</b> y reservar.</>} textoOff={<><b style={{ color: 'var(--ink)' }}>No se podrá programar.</b> Su historial se conserva.</>} /></div>
        </>}
      </Drawer>
    </>
  );
}
