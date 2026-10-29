import { useEffect, useState, type ReactNode } from "react"
import MaterialIcon from "../components/MaterialIcon"
import {
  clearSession,
  getModulePath,
  getStoredUser,
  LOGIN_PATH,
  saveSession,
  TOKEN_KEY,
  type SessionUser,
  type StaffRole,
} from "./session"

interface ModuleGuardProps {
  allowedRole: StaffRole
  children: ReactNode
}

export default function ModuleGuard({ allowedRole, children }: ModuleGuardProps) {
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    let active = true

    const validateSession = async () => {
      const storedUser = getStoredUser()
      const token = localStorage.getItem(TOKEN_KEY)

      if (!storedUser || !token) {
        window.location.replace(LOGIN_PATH)
        return
      }

      try {
        const response = await fetch("/admin/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error("Sesión no válida")

        const data = (await response.json()) as { user: SessionUser }
        saveSession(token, data.user)

        if (data.user.rol !== allowedRole) {
          window.location.replace(getModulePath(data.user.rol) ?? LOGIN_PATH)
          return
        }

        if (active) setAuthorized(true)
      } catch {
        clearSession()
        window.location.replace(LOGIN_PATH)
      }
    }

    void validateSession()
    return () => {
      active = false
    }
  }, [allowedRole])

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111827] text-white">
        <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-5 py-4">
          <MaterialIcon name="progress_activity" className="animate-spin text-2xl" />
          <span className="text-sm font-semibold">Validando tu acceso...</span>
        </div>
      </div>
    )
  }

  return children
}