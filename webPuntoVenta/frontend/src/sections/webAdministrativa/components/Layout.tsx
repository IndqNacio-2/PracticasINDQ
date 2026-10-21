import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import MaterialIcon from '../../../components/MaterialIcon';

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
      {/* Sidebar con la estructura del Punto de Venta (Material Icons, chevron
          en el encabezado y botones tipo menú), pero con la paleta original de
          Administrativa: fondo oscuro y acentos esmeralda. La navegación
          (NavLink), el filtro de roles y el cierre de sesión siguen igual. */}
      <aside
        className={`flex h-screen flex-shrink-0 flex-col overflow-hidden border-r border-slate-700/50 bg-[#0f172a] text-slate-300 shadow-sm transition-[width] duration-300 ease-in-out ${
          collapsed ? 'w-20' : 'w-60'
        }`}
      >
        {/* Encabezado e identidad visual (igual que en Punto de Venta). */}
        <div
          className={`flex h-[73px] flex-shrink-0 items-center border-b border-slate-700/50 ${
            collapsed ? 'justify-center px-3' : 'gap-3 px-5'
          }`}
        >
          {collapsed ? (
            /* Contraído: solo el chevron para volver a abrir el menú. */
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              title="Expandir menú"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm transition-all duration-150 hover:bg-emerald-600 hover:shadow-md active:scale-95"
            >
              <MaterialIcon name="chevron_right" className="text-2xl" />
            </button>
          ) : (
            <>
              {/* Logotipo del módulo administrativo. */}
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
                <MaterialIcon name="bolt" className="text-2xl" filled />
              </div>

              {/* Nombre y descripción del sistema. */}
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-base font-bold text-white">GymFit</h1>
                <p className="truncate text-xs text-slate-400">Sistema de Gestión</p>
              </div>

              {/* Botón para contraer el menú. */}
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                title="Contraer menú"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm transition-all duration-150 hover:bg-emerald-600 hover:shadow-md active:scale-95"
              >
                <MaterialIcon name="chevron_left" className="text-2xl" />
              </button>
            </>
          )}
        </div>

        {/* Opciones principales: mismos estilos de botón que Punto de Venta. */}
        <nav
          className={`flex flex-1 min-h-0 flex-col gap-1 overflow-y-auto py-4 ${
            collapsed ? 'px-2' : 'px-3'
          }`}
        >
          {!collapsed && (
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Módulos
            </p>
          )}

          {visibleItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex h-11 w-full items-center rounded-xl text-sm font-semibold transition-all duration-150 ${
                  collapsed ? 'justify-center px-0' : 'gap-3 px-3'
                } ${
                  isActive
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <MaterialIcon
                    name={item.icon}
                    className="flex-shrink-0 text-xl"
                    filled={isActive}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Usuario y cierre de sesión con la tarjeta oscura original. */}
        <div className="flex-shrink-0 border-t border-slate-700/50 p-3">
          <div
            className={`flex items-center rounded-xl bg-white/5 ${
              collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2.5'
            }`}
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
              {user ? `${user.nombre[0]}${user.apellidos[0]}` : '?'}
            </div>

            {!collapsed && user && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-200">
                  {user.nombre} {user.apellidos}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {rolLabel[user.rol]}
                </p>
              </div>
            )}
          </div>

          {/* Cerrar sesión con la misma apariencia que una opción del menú. */}
          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? 'Cerrar sesión' : undefined}
            className={`mt-2 flex h-11 w-full items-center rounded-xl text-sm font-semibold transition-all duration-150 ${
              collapsed ? 'justify-center px-0' : 'gap-3 px-3'
            } text-slate-400 hover:bg-slate-700/50 hover:text-red-400`}
          >
            <MaterialIcon name="logout" className="flex-shrink-0 text-xl" />
            {!collapsed && <span className="truncate">Cerrar sesión</span>}
          </button>
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