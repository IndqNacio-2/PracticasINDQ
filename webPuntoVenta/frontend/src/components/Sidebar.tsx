import { useState } from "react"

import type { AppModule } from "../types"

import MaterialIcon from "./MaterialIcon"
import { clearSession, getStoredUser, LOGIN_PATH } from "../auth/session"

interface SidebarProps {
  activeModule: AppModule

  onModuleChange: (module: AppModule) => void
}

interface MenuItem {
  id: AppModule

  label: string

  icon: string
}

const MENU_ITEMS: MenuItem[] = [
  { id: "sale", label: "Venta", icon: "point_of_sale" },

  { id: "inventory", label: "Inventario", icon: "inventory_2" },

  { id: "waste", label: "Mermas", icon: "delete_sweep" },

  { id: "cash-closing", label: "Corte de caja", icon: "payments" },

  { id: "reports", label: "Reportes", icon: "bar_chart" },
]

export default function Sidebar({
  activeModule,

  onModuleChange,
}: SidebarProps) {
  /* Mantengo aquí el estado porque solo el sidebar necesita conocerlo. */

  const [isExpanded, setIsExpanded] = useState(true)
  const user = getStoredUser()
  const initials = user ? `${user.nombre[0]}${user.apellidos[0]}` : "?"

  const handleLogout = () => {
    clearSession()
    window.location.assign(LOGIN_PATH)
  }

  return (
    <aside
      className={`rx-sidebar ${
        isExpanded ? "rx-sidebar--expanded" : "rx-sidebar--collapsed"
      }`}
    >
      <header
        className={`rx-sidebar-header ${
          !isExpanded ? "rx-sidebar-header--collapsed" : ""
        }`}
      >
        <div className="rx-brand-logo">
          <MaterialIcon name="fitness_center" className="text-2xl" filled />
        </div>

        {isExpanded && (
          <>
            <div className="rx-brand-content">
              <h1 className="rx-brand-title">Sistema Gym</h1>
              <p className="rx-brand-subtitle">Punto de Venta</p>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="rx-sidebar-toggle"
              aria-label="Contraer menú"
              title="Contraer menú"
            >
              <MaterialIcon name="chevron_left" className="text-xl" />
            </button>
          </>
        )}

        {!isExpanded && (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="rx-sidebar-toggle"
            aria-label="Expandir menú"
            title="Expandir menú"
          >
            <MaterialIcon name="chevron_right" className="text-xl" />
          </button>
        )}
      </header>

      <nav className="rx-sidebar-nav" aria-label="Módulos del Punto de Venta">
        {MENU_ITEMS.map((item) => {
          const isActive = activeModule === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onModuleChange(item.id)}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              title={isExpanded ? undefined : item.label}
              className={`rx-nav-item ${
                !isExpanded ? "rx-nav-item--collapsed" : ""
              } ${isActive ? "rx-nav-item--active" : ""}`}
            >
              <MaterialIcon
                name={item.icon}
                className="flex-shrink-0 text-xl"
                filled={isActive}
              />
              {isExpanded && <span className="truncate">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      <footer className="rx-sidebar-footer">
        <div
          className={`rx-user-card ${
            !isExpanded ? "rx-user-card--collapsed" : ""
          }`}
        >
          <div className="rx-user-avatar">{initials}</div>
          {isExpanded && user && (
            <div className="min-w-0">
              <p className="rx-user-name">{user.nombre} {user.apellidos}</p>
              <p className="rx-user-role">Vendedor</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          title={isExpanded ? undefined : "Cerrar sesión"}
          className={`rx-nav-item rx-nav-item--danger mt-2 ${
            !isExpanded ? "rx-nav-item--collapsed" : ""
          }`}
        >
          <MaterialIcon name="logout" className="flex-shrink-0 text-xl" />
          {isExpanded && <span className="truncate">Cerrar sesión</span>}
        </button>
      </footer>
    </aside>
  )
}
