import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { UserRole, Usuario } from '../types';
import { Icon } from './Icon';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['administrador', 'entrenador', 'recepcion'] },
  { path: '/usuarios', label: 'Usuarios', icon: 'manage_accounts', roles: ['administrador'] },
  { path: '/clientes', label: 'Clientes', icon: 'groups', roles: ['administrador', 'recepcion'] },
  { path: '/membresias', label: 'Membresías', icon: 'card_membership', roles: ['administrador', 'recepcion'] },
  { path: '/clases', label: 'Clases', icon: 'fitness_center', roles: ['administrador', 'entrenador', 'recepcion'] },
  { path: '/horarios', label: 'Horarios', icon: 'calendar_month', roles: ['administrador', 'entrenador', 'recepcion'] },
  { path: '/reservaciones', label: 'Reservaciones', icon: 'event_available', roles: ['administrador', 'recepcion', 'entrenador'] },
  { path: '/productos', label: 'Inventario', icon: 'inventory_2', roles: ['administrador', 'recepcion'] },
  { path: '/reportes', label: 'Reportes', icon: 'bar_chart', roles: ['administrador'] },
];

const rolLabel: Record<string, string> = {
  administrador: 'Administrador', entrenador: 'Entrenador',
  recepcion: 'Recepción', cliente: 'Cliente',
};

// Foto del usuario (si la tiene) o sus iniciales
function Avatar({ user, className }: { user: Pick<Usuario, 'nombre' | 'apellidos' | 'foto'>; className: string }) {
  if (user.foto) {
    return <img src={user.foto} alt="" className={`${className} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${className} rounded-full flex items-center justify-center flex-shrink-0 font-bold`}>
      {user.nombre?.[0]}{user.apellidos?.[0]}
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [pendientes, setPendientes] = useState(0);

  const visibleItems = navItems.filter(item => user && item.roles.includes(user.rol));

  // Contador de reservaciones pendientes junto al menú (se actualiza al cambiar de pantalla)
  useEffect(() => {
    let cancelado = false;
    api
      .get<unknown[]>('/reservaciones?estatus=pendiente')
      .then(r => { if (!cancelado) setPendientes(r.length); })
      .catch(() => { /* sin contador si falla */ });
    return () => { cancelado = true; };
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[color:var(--bg)]">
      {/* Barra lateral */}
      <aside
        className="flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden bg-[color:var(--dark)] text-white px-3 py-5"
        style={{ width: collapsed ? 72 : 232 }}
      >
        {/* Marca */}
        <div className={`flex items-center gap-2.5 pb-6 ${collapsed ? 'justify-center' : 'px-2'}`}>
          <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center flex-shrink-0 bg-[color:var(--accent)]">
            <Icon name="bolt" size={22} filled className="text-[color:var(--ink)]" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-white font-extrabold text-base leading-tight">GymFit</p>
              <p className="text-[11px] text-[#A8ADB7] leading-tight">Sistema de Gestión</p>
            </div>
          )}
        </div>

        {/* Menú */}
        <nav className="flex-1 overflow-y-auto space-y-1">
          {visibleItems.map(item => {
            const contador = item.path === '/reservaciones' ? pendientes : 0;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `relative flex items-center gap-2.5 rounded-xl py-[11px] text-sm font-semibold transition-colors ${collapsed ? 'justify-center px-0' : 'px-3'
                  } ${isActive ? 'bg-[color:var(--dark2)] text-white' : 'text-[#C9CDD4] hover:bg-white/5 hover:text-white'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      name={item.icon}
                      size={22}
                      weight={500}
                      filled={isActive}
                      className={`flex-shrink-0 ${isActive ? 'text-[color:var(--accent)]' : ''}`}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && contador > 0 && (
                      <span className="ml-auto text-[11px] font-bold rounded-full px-2 py-px bg-[color:var(--accent)] text-[color:var(--ink)]">
                        {contador}
                      </span>
                    )}
                    {collapsed && contador > 0 && (
                      <span className="absolute top-2 right-3 w-2 h-2 rounded-full bg-[color:var(--accent)]" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Usuario y controles */}
        <div className="space-y-2 pt-3">
          {user && (
            <div className={`flex items-center gap-2.5 rounded-[14px] bg-[color:var(--dark2)] ${collapsed ? 'justify-center p-2' : 'p-3'}`}>
              <Avatar user={user} className="w-[34px] h-[34px] bg-[#3A3E47] text-white text-xs" />
              {!collapsed && (
                <div className="overflow-hidden flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white truncate">{user.nombre} {user.apellidos}</p>
                  <p className="text-xs text-[#A8ADB7] truncate">{rolLabel[user.rol]}</p>
                </div>
              )}
            </div>
          )}
          <div className={`flex gap-2 ${collapsed ? 'flex-col items-center' : 'px-1'}`}>
            <button
              onClick={() => setCollapsed(c => !c)}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-[#A8ADB7] hover:text-white hover:bg-white/10 transition-colors"
              title={collapsed ? 'Expandir' : 'Colapsar'}
            >
              <Icon name={collapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'} size={20} weight={500} />
            </button>
            <button
              onClick={handleLogout}
              className={`flex items-center justify-center w-8 h-8 rounded-lg text-[#A8ADB7] hover:text-[#FF8A8A] hover:bg-white/10 transition-colors ${collapsed ? '' : 'ml-auto'}`}
              title="Cerrar sesión"
            >
              <Icon name="logout" size={20} weight={500} />
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-[color:var(--line)] flex items-center justify-between px-6 flex-shrink-0">
          <div />
          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-[color:var(--ink2)]">
                <div className="w-2 h-2 rounded-full bg-[color:var(--ok)]" />
                <span className="font-semibold text-[color:var(--ink)]">{user.nombre} {user.apellidos}</span>
                <span className="text-[color:var(--ink3)]">·</span>
                <span className="text-[color:var(--ink3)]">{rolLabel[user.rol]}</span>
              </div>
              <Avatar user={user} className="w-8 h-8 bg-[color:var(--dark)] text-[color:var(--accent)] text-xs" />
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}