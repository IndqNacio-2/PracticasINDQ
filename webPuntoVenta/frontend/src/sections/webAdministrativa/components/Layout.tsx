import { useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router"
import MaterialIcon from "../../../components/MaterialIcon"
import { useAuth } from "../context/AuthContext"
import type { UserRole } from "../types"

interface NavItem {
  path: string
  label: string
  icon: string
  roles: UserRole[]
}

const navItems: NavItem[] = [
  {
    path: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    roles: ["administrador", "entrenador", "recepcion"],
  },
  {
    path: "/usuarios",
    label: "Usuarios",
    icon: "manage_accounts",
    roles: ["administrador"],
  },
  {
    path: "/clientes",
    label: "Clientes",
    icon: "groups",
    roles: ["administrador", "recepcion"],
  },
  {
    path: "/clases",
    label: "Clases",
    icon: "fitness_center",
    roles: ["administrador", "entrenador", "recepcion"],
  },
  {
    path: "/horarios",
    label: "Horarios",
    icon: "calendar_month",
    roles: ["administrador", "entrenador", "recepcion"],
  },
  {
    path: "/reservaciones",
    label: "Reservaciones",
    icon: "event_available",
    roles: ["administrador", "recepcion", "entrenador"],
  },
  {
    path: "/productos",
    label: "Inventario",
    icon: "inventory_2",
    roles: ["administrador", "recepcion"],
  },
  {
    path: "/reportes",
    label: "Reportes",
    icon: "bar_chart",
    roles: ["administrador"],
  },
]

const rolLabel: Record<string, string> = {
  administrador: "Administrador",
  entrenador: "Entrenador",
  recepcion: "Recepción",
  cliente: "Cliente",
}

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const visibleItems = navItems.filter(
    (item) => user && item.roles.includes(user.rol),
  )

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <div className="rx-admin-shell">
      <aside
        className={`rx-sidebar ${
          collapsed ? "rx-sidebar--collapsed" : "rx-sidebar--expanded"
        }`}
      >
        <div
          className={`rx-sidebar-header ${
            collapsed ? "rx-sidebar-header--collapsed" : ""
          }`}
        >
          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              title="Expandir menú"
              aria-label="Expandir menú"
              aria-expanded={false}
              className="rx-sidebar-toggle"
            >
              <MaterialIcon name="chevron_right" className="text-2xl" />
            </button>
          ) : (
            <>
              <div className="rx-brand-logo">
                <MaterialIcon name="bolt" className="text-2xl" filled />
              </div>
              <div className="rx-brand-content">
                <p className="rx-brand-title">Recepción</p>
                <p className="rx-brand-subtitle">Administración</p>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                title="Contraer menú"
                aria-label="Contraer menú"
                aria-expanded={true}
                className="rx-sidebar-toggle"
              >
                <MaterialIcon name="chevron_left" className="text-xl" />
              </button>
            </>
          )}
        </div>

        <nav className="rx-sidebar-nav" aria-label="Navegación administrativa">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `rx-nav-item ${collapsed ? "rx-nav-item--collapsed" : ""} ${
                  isActive ? "rx-nav-item--active" : ""
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

        <div className="rx-sidebar-footer">
          <div
            className={`rx-user-card ${
              collapsed ? "rx-user-card--collapsed" : ""
            }`}
          >
            <div className="rx-user-avatar">
              {user ? `${user.nombre[0]}${user.apellidos[0]}` : "?"}
            </div>
            {!collapsed && user && (
              <div className="rx-user-copy">
                <p className="rx-user-name">
                  {user.nombre} {user.apellidos}
                </p>
                <p className="rx-user-role">{rolLabel[user.rol]}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? "Cerrar sesión" : undefined}
            className={`rx-nav-item rx-nav-item--danger ${
              collapsed ? "rx-nav-item--collapsed" : ""
            }`}
          >
            <MaterialIcon name="logout" className="flex-shrink-0 text-xl" />
            {!collapsed && <span className="truncate">Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      <div className="rx-admin-main">
        <header className="rx-admin-topbar">
          <div className="rx-admin-topbar-context">
            <span className="rx-admin-topbar-kicker">Centro operativo</span>
            <strong>Panel administrativo</strong>
          </div>
          <div className="rx-admin-topbar-user">
            <div className="rx-admin-presence" aria-label="Sesión activa">
              <span className="rx-admin-presence-dot" />
              <span className="rx-admin-user-name">
                {user?.nombre} {user?.apellidos}
              </span>
              <span className="rx-admin-user-role">
                {rolLabel[user?.rol ?? ""]}
              </span>
            </div>
            <div className="rx-user-avatar rx-user-avatar--topbar">
              {user?.nombre[0]}
              {user?.apellidos[0]}
            </div>
          </div>
        </header>
        <main className="rx-admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
