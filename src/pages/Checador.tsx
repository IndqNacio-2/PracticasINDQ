import { useEffect, useRef, useState } from 'react';
import { cobro, mensajeError } from '../lib/api';
import { DIA_LARGO, fechaRelativa, horaDe, iniciales, MES_LARGO } from '../lib/format';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/kit';

interface Persona { tipo: string; codigo: string; nombre: string; rol: string | null; marcoHoy: boolean; ultimaMarcaHoy: string | null; siguienteTipo: 'entrada' | 'salida' }
interface Marca { _id: number; codigo: string; nombre: string; tipo: 'entrada' | 'salida'; estado: string | null; fecha: string }

const ESTADO: Record<string, [string, string]> = { puntual: ['Puntual', 'st-asis'], retardo: ['Retardo', 'st-noas'], inasistencia: ['Falta', 'st-canc'], sin_turno: ['Sin turno', 'st-pend'] };

/** Reloj checador: el cliente o el empleado escribe su código y se registra su entrada o salida. */
export default function Checador() {
  const [ahora, setAhora] = useState(new Date());
  const [codigo, setCodigo] = useState('');
  const [persona, setPersona] = useState<Persona | null>(null);
  const [historial, setHistorial] = useState<Marca[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; t: string; d?: string } | null>(null);
  const [cargando, setCargando] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const limpiar = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { const t = setInterval(() => setAhora(new Date()), 1000); input.current?.focus(); return () => clearInterval(t); }, []);
  const reiniciar = (ms = 8000) => { clearTimeout(limpiar.current); limpiar.current = setTimeout(() => { setPersona(null); setHistorial([]); setMsg(null); setCodigo(''); input.current?.focus(); }, ms); };

  const buscar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cod = codigo.trim().toUpperCase();
    if (!cod) return;
    setCargando(true); setMsg(null); setPersona(null);
    try {
      const p = await cobro.get<Persona>(`/asistencia/empleado/${encodeURIComponent(cod)}`);
      setPersona(p);
      setHistorial(await cobro.get<Marca[]>(`/asistencia/historial/${encodeURIComponent(p.codigo)}`).catch(() => []));
      reiniciar(20000);
    } catch (err) { setMsg({ ok: false, t: 'Código no encontrado', d: mensajeError(err) }); reiniciar(); }
    finally { setCargando(false); }
  };

  const marcar = async () => {
    if (!persona) return;
    setCargando(true);
    try {
      const m = await cobro.post<Marca>('/asistencia/marcar', { codigo: persona.codigo });
      setMsg({ ok: true, t: m.tipo === 'entrada' ? `¡Bienvenido, ${persona.nombre.split(' ')[0]}!` : `¡Hasta pronto, ${persona.nombre.split(' ')[0]}!`, d: `${m.tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada a las ${horaDe(m.fecha)}.` });
      setHistorial((h) => [m, ...h].slice(0, 10));
      setPersona({ ...persona, siguienteTipo: m.tipo === 'entrada' ? 'salida' : 'entrada', marcoHoy: true });
      reiniciar(6000);
    } catch (err) { setMsg({ ok: false, t: 'No se pudo registrar', d: mensajeError(err) }); reiniciar(); }
    finally { setCargando(false); }
  };

  const dia = DIA_LARGO[ahora.getDay()];
  return (
    <div className="nu-chk">
      <div className="nu-clock">
        <span className="hlbl">Hybrid Training Club</span>
        <b>{ahora.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</b>
        <small>{dia.charAt(0).toUpperCase() + dia.slice(1)} {ahora.getDate()} de {MES_LARGO[ahora.getMonth()]} de {ahora.getFullYear()}</small>
      </div>
      <form className="nu-codebar nu-codebig" onSubmit={buscar}>
        <input ref={input} className="mono" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Escribe tu código (CLI001 o EMP-101)" aria-label="Código de acceso" autoComplete="off" />
        <button className="btn acc" disabled={cargando || !codigo.trim()}>{cargando ? <span className="nu-spin" /> : <Icon n="entrar" />}Continuar</button>
      </form>
      {msg && (
        <div className={`nu-chkmsg ${msg.ok ? 'ok' : 'bad'}`} role="status"><span className="tsic"><Icon n={msg.ok ? 'check' : 'alerta'} w={2.6} /></span><div><b>{msg.t}</b>{msg.d && <p>{msg.d}</p>}</div></div>
      )}
      {persona && (
        <div className="dc nu-chkp">
          <div className="rsum" style={{ paddingTop: 0 }}>
            <Avatar texto={iniciales(persona.nombre)} size={52} />
            <div><b style={{ fontSize: 19 }}>{persona.nombre}</b><small>{persona.tipo === 'empleado' ? `Empleado · ${persona.rol ?? ''}` : 'Cliente'} · <span className="rcode">{persona.codigo}</span></small></div>
          </div>
          <button className="btn acc wide" style={{ marginTop: 18 }} disabled={cargando} onClick={marcar}><Icon n={persona.siguienteTipo === 'entrada' ? 'entrar' : 'salir'} />Registrar {persona.siguienteTipo}</button>
          {historial.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="lbl">Últimos registros</div>
              {historial.slice(0, 5).map((m) => (
                <div className="tpi" key={m._id}><span className="rk"><Icon n={m.tipo === 'entrada' ? 'flechaDer' : 'salir'} /></span>
                  <div><b style={{ textTransform: 'capitalize' }}>{m.tipo}</b><small>{fechaRelativa(m.fecha)} · {horaDe(m.fecha)}</small></div>
                  <div className="qn">{m.estado && ESTADO[m.estado] ? <span className={`pill ${ESTADO[m.estado][1]}`}>{ESTADO[m.estado][0]}</span> : null}</div></div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
