import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { admin, mensajeError } from '../lib/api';
import { guardarSesion, inicioDe, MODULOS_POR_ROL, token, usuarioGuardado, type Usuario } from '../lib/session';
import { okCorreo } from '../lib/format';
import '../styles/login.css';

type Vista = 'login' | 'olvido' | 'enviado' | 'restablecer';
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 5 * 60_000;
const ESPERA_REENVIO = 120_000;
const RK = 'nuucleo_rec_mail';
const mmss = (ms: number) => { const t = Math.ceil(ms / 1e3); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

export default function Login() {
  const nav = useNavigate();
  const tokenReset = new URLSearchParams(window.location.search).get('restablecer');
  const [vista, setVista] = useState<Vista>(tokenReset ? 'restablecer' : 'login');
  const [correo, setCorreo] = useState(() => localStorage.getItem(RK) ?? '');
  const [pass, setPass] = useState('');
  const [verPass, setVerPass] = useState(false);
  const [recordar, setRecordar] = useState(() => !!localStorage.getItem(RK));
  const [errs, setErrs] = useState<{ mail?: boolean; pass?: boolean }>({});
  const [alerta, setAlerta] = useState<{ html: React.ReactNode; info?: boolean; icon?: 'alerta' | 'candado' | 'reloj' } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [caps, setCaps] = useState(false);
  const [fallos, setFallos] = useState(0);
  const [bloqueoHasta, setBloqueoHasta] = useState(0);
  const [reenvioHasta, setReenvioHasta] = useState(0);
  const [ahora, setAhora] = useState(Date.now());
  const [correoOlvido, setCorreoOlvido] = useState('');
  const [nueva, setNueva] = useState('');
  const [toast, setToast] = useState<{ t: string; d: string } | null>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const mailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const u = usuarioGuardado();
    if (u && token() && !tokenReset) nav(inicioDe(u.rol), { replace: true });
    if (sessionStorage.getItem('nuucleo_motivo_salida') === 'inactividad') {
      sessionStorage.removeItem('nuucleo_motivo_salida');
      setAlerta({ html: <>Tu sesión se cerró tras <b>30 minutos sin actividad</b>. Vuelve a iniciar sesión para continuar.</>, info: true, icon: 'reloj' });
    }
    setTimeout(() => (correo ? passRef.current : mailRef.current)?.focus(), 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bloqueoHasta && !reenvioHasta) return;
    const t = setInterval(() => {
      const n = Date.now();
      setAhora(n);
      if (bloqueoHasta && n >= bloqueoHasta) { setBloqueoHasta(0); setFallos(0); setAlerta(null); }
    }, 1000);
    return () => clearInterval(t);
  }, [bloqueoHasta, reenvioHasta]);

  const mostrarToast = (t: string, d: string) => { setToast({ t, d }); setTimeout(() => setToast(null), 4500); };
  const bloqueado = bloqueoHasta > ahora;

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bloqueado) return;
    const m = okCorreo(correo), p = pass.length >= 3;
    setErrs({ mail: !m, pass: !p });
    if (!m) return mailRef.current?.focus();
    if (!p) return passRef.current?.focus();
    setCargando(true);
    try {
      const r = await admin.post<{ token: string; user: Usuario }>('/auth/login', { correo: correo.trim(), password: pass });
      if (!MODULOS_POR_ROL[r.user.rol]?.length) {
        setAlerta({ html: <>Tu rol (<b>{r.user.rol}</b>) no tiene acceso a la plataforma web. Usa la app de Nuucleo.</> });
        setCargando(false);
        return;
      }
      if (recordar) localStorage.setItem(RK, correo.trim()); else localStorage.removeItem(RK);
      guardarSesion(r.token, r.user);
      nav(inicioDe(r.user.rol), { replace: true });
    } catch (err) {
      setCargando(false);
      const f = fallos + 1;
      setFallos(f);
      if (f >= MAX_INTENTOS) {
        setBloqueoHasta(Date.now() + BLOQUEO_MS);
        setAhora(Date.now());
        return;
      }
      const quedan = MAX_INTENTOS - f;
      const msg = (err as { status?: number }).status === 401
        ? <>El correo o la contraseña no coinciden. {quedan <= 3 ? <b>Te {quedan === 1 ? 'queda 1 intento' : `quedan ${quedan} intentos`} antes de que se bloquee el acceso.</b> : 'Revísalos e inténtalo de nuevo.'}</>
        : <>{mensajeError(err)}</>;
      setAlerta({ html: msg });
      passRef.current?.select();
    }
  };

  const pedirEnlace = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!okCorreo(correoOlvido)) { setErrs({ mail: true }); return; }
    try {
      await admin.post('/auth/recuperar', { correo: correoOlvido.trim() });
      setVista('enviado');
      setReenvioHasta(Date.now() + ESPERA_REENVIO);
      setAhora(Date.now());
      mostrarToast('Enlace enviado', `Revisa la bandeja de entrada de ${correoOlvido.trim()}.`);
    } catch (err) {
      // Si el servidor no tiene habilitada la recuperación por correo, se orienta a la persona.
      mostrarToast('No se pudo enviar', (err as { status?: number }).status === 404
        ? 'La recuperación por correo no está disponible. Pide al administrador del club que restablezca tu contraseña.'
        : mensajeError(err));
    }
  };

  const restablecer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nueva.length < 8) { setErrs({ pass: true }); return; }
    try {
      await admin.post('/auth/restablecer', { token: tokenReset, password: nueva });
      window.history.replaceState({}, '', '/login');
      setVista('login');
      setAlerta({ html: <>Contraseña actualizada. Ya puedes iniciar sesión.</>, info: true, icon: 'candado' });
    } catch (err) {
      setAlerta({ html: <>{mensajeError(err)}</> });
    }
  };

  const alertaFinal = bloqueado
    ? { html: <><b>Demasiados intentos.</b> Por seguridad bloqueamos el acceso por 5 minutos (faltan {mmss(bloqueoHasta - ahora)}). También puedes <button type="button" className="link" onClick={() => { setCorreoOlvido(correo); setVista('olvido'); }}>recuperar tu contraseña</button>.</>, icon: 'candado' as const }
    : alerta;

  return (
    <div className="lg">
      <div className="stage"><div className="lg-wrap">
        <section className="lg-hero" aria-hidden="true">
          <img className="hlogo" src="/branding/nuucleo-logo-blanco.png" alt="" />
          <div className="htxt">
            <h1>Hybrid Training<br /><em>Club</em></h1>
            <p>Plataforma de gestión para la operación del club.</p>
            <div className="hmeta">
              <span><Icon n="check" w={2.2} />Asistencia</span>
              <span><Icon n="dinero" />Cobros</span>
              <span><Icon n="clientes" />Clientes</span>
            </div>
          </div>
        </section>
        <section className="lg-side">
          <img className="mlogo" src="/branding/nuucleo-logo-blanco.png" alt="Nuucleo" />
          <div className="center"><div className="box">
            {vista === 'login' && (
              <div className="view on" id="vLogin">
                <h2>¡Hola de nuevo!</h2>
                <p className="sub">Inicia sesión para continuar</p>
                {alertaFinal && (
                  <div className={`alert show ${'info' in alertaFinal && alertaFinal.info ? 'info' : ''}`} role="alert">
                    <Icon n={alertaFinal.icon ?? 'alerta'} /><span>{alertaFinal.html}</span>
                  </div>
                )}
                <form onSubmit={entrar} noValidate>
                  <div className={`fld ${errs.mail ? 'err' : ''}`}>
                    <label htmlFor="lgMail">Correo electrónico</label>
                    <div className="iw"><input id="lgMail" ref={mailRef} type="email" autoComplete="username" inputMode="email" placeholder="nombre@nuucleo.mx"
                      value={correo} onChange={(e) => { setCorreo(e.target.value); setErrs({}); if (!bloqueado && !alerta?.info) setAlerta(null); }} /></div>
                    <div className="msg">Escribe un correo válido.</div>
                  </div>
                  <div className={`fld ${errs.pass ? 'err' : ''}`}>
                    <label htmlFor="lgPass">Contraseña</label>
                    <div className="iw pw">
                      <input id="lgPass" ref={passRef} type={verPass ? 'text' : 'password'} autoComplete="current-password" placeholder="Tu contraseña"
                        value={pass} onChange={(e) => { setPass(e.target.value); setErrs({}); }}
                        onKeyDown={(e) => setCaps(e.getModifierState?.('CapsLock'))} onKeyUp={(e) => setCaps(e.getModifierState?.('CapsLock'))} onBlur={() => setCaps(false)} />
                      <button type="button" className="fhelp" aria-label="¿Olvidaste tu contraseña? Da clic aquí" onClick={() => { setCorreoOlvido(correo); setErrs({}); setVista('olvido'); }}>
                        <Icon n="alerta" /><span className="tip" role="tooltip">¿Olvidaste tu contraseña? <b>Da clic aquí</b></span>
                      </button>
                      <button type="button" className="eye" aria-label={verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setVerPass(!verPass)}><Icon n={verPass ? 'ojoNo' : 'ojo'} /></button>
                    </div>
                    <div className="msg">Escribe tu contraseña.</div>
                    {caps && <div className="caps"><Icon n="flechaArriba" w={2.2} />Mayúsculas activadas</div>}
                  </div>
                  <div className="lrow"><label className="lrem"><input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} /><span className="rbox" />Mantener sesión iniciada en este equipo</label></div>
                  <button type="submit" className="btn glass" disabled={cargando || bloqueado}>
                    {bloqueado ? `Espera ${mmss(bloqueoHasta - ahora)}` : cargando ? <><span className="spin" />Entrando…</> : <><Icon n="entrar" />Iniciar sesión</>}
                  </button>
                  <p className="help">¿Problemas para entrar? Contacta al administrador del club.</p>
                </form>
              </div>
            )}

            {vista === 'olvido' && (
              <div className="view on">
                <button className="back" onClick={() => { setVista('login'); setErrs({}); }}><Icon n="chevL" w={2.4} />Regresar</button>
                <h2>Recupera tu contraseña</h2>
                <p className="sub">Escribe el correo con el que entras a la plataforma y te enviaremos un enlace para crear una nueva.</p>
                <form onSubmit={pedirEnlace} noValidate>
                  <div className={`fld ${errs.mail ? 'err' : ''}`}>
                    <label htmlFor="fgMail">Correo electrónico</label>
                    <div className="iw"><input id="fgMail" type="email" autoFocus inputMode="email" placeholder="nombre@nuucleo.mx" value={correoOlvido} onChange={(e) => { setCorreoOlvido(e.target.value); setErrs({}); }} /></div>
                    <div className="msg">Escribe un correo válido.</div>
                  </div>
                  <button type="submit" className="btn glass" style={{ marginTop: 10 }}><Icon n="enviar" />Enviar enlace</button>
                </form>
                <div className="note"><Icon n="info" /><span>¿Ya no tienes acceso a ese correo? Pide al administrador del club que restablezca tu cuenta.</span></div>
              </div>
            )}

            {vista === 'enviado' && (
              <div className="view on sent" id="vSent">
                <div className="ic"><Icon n="correo" w={2.2} /></div>
                <h2>Revisa tu correo</h2>
                <p className="sub">Si <b>{correoOlvido}</b> está registrado, te enviamos un enlace. Es válido por 30 minutos.</p>
                <button className="btn glass" onClick={() => setVista('login')}><Icon n="entrar" />Regresar a iniciar sesión</button>
                <button className="btn ghost" id="resend" disabled={reenvioHasta > ahora} onClick={() => pedirEnlace()}>
                  {reenvioHasta > ahora ? <span>Reenviar enlace en <b>{mmss(reenvioHasta - ahora)}</b></span> : 'Reenviar enlace'}
                </button>
              </div>
            )}

            {vista === 'restablecer' && (
              <div className="view on">
                <h2>Crea una nueva contraseña</h2>
                <p className="sub">Escribe al menos 8 caracteres. Después podrás iniciar sesión con ella.</p>
                {alerta && <div className="alert show" role="alert"><Icon n="alerta" /><span>{alerta.html}</span></div>}
                <form onSubmit={restablecer} noValidate>
                  <div className={`fld ${errs.pass ? 'err' : ''}`}>
                    <label htmlFor="nwPass">Nueva contraseña</label>
                    <div className="iw pw"><input id="nwPass" type={verPass ? 'text' : 'password'} autoFocus autoComplete="new-password" value={nueva} onChange={(e) => { setNueva(e.target.value); setErrs({}); }} />
                      <button type="button" className="eye" style={{ right: 6 }} aria-label="Mostrar contraseña" onClick={() => setVerPass(!verPass)}><Icon n={verPass ? 'ojoNo' : 'ojo'} /></button></div>
                    <div className="msg">Escribe al menos 8 caracteres.</div>
                  </div>
                  <button type="submit" className="btn glass"><Icon n="check" />Guardar contraseña</button>
                  <button type="button" className="btn ghost" onClick={() => { window.history.replaceState({}, '', '/login'); setAlerta(null); setVista('login'); }}>Cancelar</button>
                </form>
              </div>
            )}
          </div></div>
          <div className="lg-foot"><span>© 2026 Nuucleo Hybrid Training Club</span></div>
        </section>
      </div></div>
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">
        <span className="tsic"><Icon n="check" w={2.6} /></span><div><b>{toast?.t}</b><p>{toast?.d}</p></div>
      </div>
    </div>
  );
}
