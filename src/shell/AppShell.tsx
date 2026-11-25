import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../ui/Icon';
import { admin } from '../lib/api';
import { cerrarSesion, guardarSesion, inicioDe, LOGIN_PATH, MODULOS_POR_ROL, puede, ROL_NOMBRE, token, usuarioGuardado, type Modulo, type Usuario } from '../lib/session';
import { fechaLarga, iniciales } from '../lib/format';

export const MODULO_INFO: Record<Modulo, { label: string; icon: IconName; titulo?: string }> = {
  dashboard: { label: 'Dashboard', icon: 'dashboard' },
  recepcion: { label: 'Recepción', icon: 'recepcion' },
  venta: { label: 'Punto de venta', icon: 'venta' },
  usuarios: { label: 'Usuarios', icon: 'usuarios' },
  clientes: { label: 'Clientes', icon: 'clientes' },
  clases: { label: 'Clases y horarios', icon: 'clases' },
  membresias: { label: 'Membresías', icon: 'membresias' },
  reservaciones: { label: 'Reservaciones', icon: 'reservaciones' },
  inventario: { label: 'Inventario', icon: 'inventario' },
  movimientos: { label: 'Movimientos', icon: 'movimientos' },
  merma: { label: 'Merma', icon: 'merma' },
  corte: { label: 'Corte de caja', icon: 'corte' },
  reportes: { label: 'Reportes', icon: 'reportes' },
  checador: { label: 'Checador', icon: 'checador' },
};

const SUBTITULO: Record<string, string> = {
  administrador: 'Administración', recepcion: 'Recepción', vendedor: 'Punto de venta', checador: 'Checador', entrenador: 'Entrenador',
};

const SesionCtx = createContext<Usuario | null>(null);
export const useSesion = () => useContext(SesionCtx)!;

const INACTIVIDAD_MS = 30 * 60_000;

export function AppShell({ modulo, children }: { modulo: Modulo; children: ReactNode }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [usuario, setUsuario] = useState<Usuario | null>(usuarioGuardado());
  const [validado, setValidado] = useState(false);
  const [mini, setMini] = useState(() => localStorage.getItem('nu_menu_mini') === '1');
  const [ahora, setAhora] = useState(new Date());

  // Valida la sesión con el servidor (rol y estatus actuales).
  useEffect(() => {
    if (!token()) return;
    let vivo = true;
    admin.get<{ user: Usuario }>('/auth/me')
      .then(({ user }) => { if (!vivo) return; guardarSesion(token(), user); setUsuario(user); setValidado(true); })
      .catch(() => { cerrarSesion(); nav(LOGIN_PATH, { replace: true }); });
    return () => { vivo = false; };
  }, [nav]);

  // Reloj de la barra superior.
  useEffect(() => { const t = setInterval(() => setAhora(new Date()), 30_000); return () => clearInterval(t); }, []);

  // Cierre por inactividad (30 minutos sin actividad).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const reiniciar = () => {
      clearTimeout(t);
      t = setTimeout(() => { cerrarSesion('inactividad'); window.location.assign(LOGIN_PATH); }, INACTIVIDAD_MS);
    };
    const eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    eventos.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }));
    reiniciar();
    return () => { clearTimeout(t); eventos.forEach((e) => window.removeEventListener(e, reiniciar)); };
  }, []);

  useEffect(() => { localStorage.setItem('nu_menu_mini', mini ? '1' : '0'); }, [mini]);

  if (!token() || !usuario) return <Navigate to={LOGIN_PATH} replace state={{ desde: loc.pathname }} />;
  if (!puede(usuario.rol, modulo)) return <Navigate to={inicioDe(usuario.rol)} replace />;
  if (!validado) return <div className="nu-boot"><span className="nu-spin" />Validando tu acceso…</div>;

  const salir = () => { cerrarSesion(); nav(LOGIN_PATH, { replace: true }); };
  const nombre = `${usuario.nombre} ${usuario.apellidos}`.trim();
  const ini = iniciales(usuario.nombre, usuario.apellidos);
  const soloChecador = usuario.rol === 'checador';

  return (
    <SesionCtx.Provider value={usuario}>
      <div className={`app ${mini ? 'mini' : ''} ${soloChecador ? 'nu-solo' : ''}`}>
        {!soloChecador && (
          <aside className="side">
            <button className="stog2" onClick={() => setMini(!mini)} aria-label={mini ? 'Expandir menú' : 'Contraer menú'}><Icon n="chevL" w={2.4} /></button>
            <div className="brand">
              <img className="bimg" src="/branding/nuucleo-logo-blanco.png" alt="Nuucleo" />
              <img className="biso" src="/branding/nuucleo-isotipo.png" alt="Nuucleo" />
              <small>{SUBTITULO[usuario.rol]}</small>
            </div>
            <nav className="nav">
              {MODULOS_POR_ROL[usuario.rol].map((m) => (
                <NavLink key={m} to={`/${m}`} data-label={MODULO_INFO[m].label} className={({ isActive }) => (isActive ? 'on' : '')}>
                  <Icon n={MODULO_INFO[m].icon} />{MODULO_INFO[m].label}
                </NavLink>
              ))}
            </nav>
            <div className="foot">
              <div className="me"><i>{ini}</i><div><b>{nombre}</b><small>{ROL_NOMBRE[usuario.rol]}</small></div></div>
              <button className="out" onClick={salir}><Icon n="salir" />Cerrar sesión</button>
            </div>
          </aside>
        )}
        <main>
          <div className="topbar">
            <div><h1>{MODULO_INFO[modulo].label}</h1><div className="date">{fechaLarga(ahora)}</div></div>
            <div className="nu-topr">
              {soloChecador && <button className="btn line sm" onClick={salir}><Icon n="salir" />Cerrar sesión</button>}
              <div className="tuser" aria-label="Mi cuenta">
                <span className="tu-tx"><b><i className="tu-dot" />{nombre}</b><small>{ROL_NOMBRE[usuario.rol]}</small></span>
                <span className="tu-av">{usuario.foto ? <img src={usuario.foto} alt="" /> : ini}</span>
              </div>
            </div>
          </div>
          <div className="wrap">{children}</div>
        </main>
      </div>
    </SesionCtx.Provider>
  );
}
