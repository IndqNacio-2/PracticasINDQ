import { useState } from "react"
import MaterialIcon from "../components/MaterialIcon"
import {
  clearSession,
  getModulePath,
  saveSession,
  type SessionUser,
} from "./session"

interface LoginResponse {
  token: string
  user: SessionUser
}

export default function LoginPage() {
  const [correo, setCorreo] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/admin/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, password }),
      })

      const data = (await response.json()) as LoginResponse | { message?: string }
      if (!response.ok || !("token" in data)) {
        throw new Error(
          "message" in data && data.message
            ? data.message
            : "No se pudo iniciar sesión.",
        )
      }

      const modulePath = getModulePath(data.user.rol)
      if (!modulePath) {
        clearSession()
        throw new Error("Tu rol todavía no tiene un módulo asignado.")
      }

      saveSession(data.token, data.user)
      window.location.assign(modulePath)
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "No se pudo iniciar sesión.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#111827] px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden bg-gradient-to-br from-[#111827] via-[#1f2937] to-[#374151] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
              <MaterialIcon name="fitness_center" className="text-2xl" filled />
            </div>
            <div>
              <p className="text-lg font-bold">Sistema Gym</p>
              <p className="text-sm text-gray-300">Acceso del personal</p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">
              Un solo acceso
            </p>
            <h1 className="text-4xl font-bold leading-tight">
              Entra directamente al módulo que te corresponde.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-gray-300">
              El sistema identifica tu rol y abre automáticamente Administración,
              Cobro o Punto de Venta.
            </p>
          </div>

          <p className="text-sm text-gray-400">Sistema de reservación de clases</p>
        </section>

        <section className="p-7 sm:p-10 lg:p-12">
          <div className="mb-8">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
              Bienvenido
            </p>
            <h2 className="text-3xl font-bold text-gray-900">Iniciar sesión</h2>
            <p className="mt-2 text-sm text-gray-500">
              Ingresa tus credenciales para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block text-sm font-semibold text-gray-700">
              Correo electrónico
              <input
                type="email"
                required
                autoComplete="username"
                value={correo}
                onChange={(event) => setCorreo(event.target.value)}
                placeholder="usuario@gymfit.mx"
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-4 text-sm text-gray-900 outline-none focus:border-gray-500 focus:ring-4 focus:ring-gray-100"
              />
            </label>

            <label className="block text-sm font-semibold text-gray-700">
              Contraseña
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-4 text-sm text-gray-900 outline-none focus:border-gray-500 focus:ring-4 focus:ring-gray-100"
              />
            </label>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#111827] px-5 text-sm font-bold text-white hover:bg-[#374151] disabled:opacity-60"
            >
              {loading ? "Verificando..." : "Ingresar al sistema"}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}