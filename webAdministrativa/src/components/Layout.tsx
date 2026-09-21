import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
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
  { path: '/clases', label: 'Clases', icon: 'fitness_center', roles: ['administrador', 'entrenador', 'recepcion'] },
  { path: '/horarios', label: 'Horarios', icon: 'calendar_month', roles: ['administrador', 'entrenador', 'recepcion'] },
  { path: '/reservaciones', label: 'Reservaciones', icon: 'event_available', roles: ['administrador', 'recepcion', 'entrenador'] },
  { path: '/productos', label: 'Inventario', icon: 'inventory_2', roles: ['administrador', 'recepcion'] },
  { path: '/reportes', label: 'Reportes', icon: 'bar_chart', roles: ['administrador'] },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = navItems.filter(item => user && item.roles.includes(user.rol));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const rolLabel: Record<string, string> = {
    administrador: 'Administrador', entrenador: 'Entrenador',
    recepcion: 'Recepción', cliente: 'Cliente',
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside
        className="flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden"
        style={{ width: collapsed ? 64 : 240, backgroundColor: '#0f172a' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500">
            <Icon name="bolt" size={20} filled className="text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-white font-bold text-sm leading-none" style={{ fontFamily: 'DM Sans, sans-serif' }}>GymFit</p>
              <p className="text-slate-400 text-xs mt-0.5">Sistema de Gestión</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          {visibleItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0 flex items-center">
                <Icon name={item.icon} size={22} weight={500} />
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User & collapse */}
        <div className="border-t border-slate-700/50 p-3 space-y-2">
          {!collapsed && user && (
            <div className="flex items-center gap-2.5 px-2 py-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                {user.nombre[0]}{user.apellidos[0]}
              </div>
              <div className="overflow-hidden flex-1 min-w-0">
                <p className="text-slate-200 text-xs font-medium truncate">{user.nombre} {user.apellidos}</p>
                <p className="text-slate-500 text-xs truncate">{rolLabel[user.rol]}</p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setCollapsed(c => !c)}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
              title={collapsed ? 'Expandir' : 'Colapsar'}
            >
              <Icon
                name={collapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
                size={20}
                weight={500}
              />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
              title="Cerrar sesión"
            >
              <Icon name="logout" size={20} weight={500} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-6 flex-shrink-0">
          <div />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="font-medium">{user?.nombre} {user?.apellidos}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-400">{rolLabel[user?.rol ?? '']}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">
              {user?.nombre[0]}{user?.apellidos[0]}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}