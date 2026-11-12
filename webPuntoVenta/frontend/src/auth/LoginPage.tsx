import { useState } from "react"
import BrandLogo from "../components/BrandLogo"
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
    <main className="rx-login">
      <div className="rx-login-shell">
        <section className="rx-login-brand" aria-labelledby="login-welcome">
          <div className="rx-login-brand-header">
            <BrandLogo className="rx-login-logo" />
            <span className="rx-login-access">Acceso del personal</span>
          </div>

          <div className="rx-login-welcome">
            <span className="rx-login-accent" aria-hidden="true" />
            <h1 id="login-welcome">
              Bienvenido a <span>NUUCLEO</span>
            </h1>
            <p>
              Gestiona clases, reservaciones, asistencias y ventas en un solo lugar.
            </p>
          </div>

        </section>

        <section className="rx-login-content" aria-labelledby="login-title">
          <div className="rx-login-heading">
            <p className="rx-label">
              Comienza tu jornada
            </p>
            <h2 id="login-title">Iniciar sesión</h2>
            <p className="rx-login-description">
              Ingresa tus credenciales para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="rx-login-form" aria-busy={loading}>
            <label className="rx-field">
              <span className="rx-label">Correo electrónico</span>
              <input
                type="email"
                required
                autoComplete="username"
                value={correo}
                onChange={(event) => setCorreo(event.target.value)}
                placeholder="Tu correo electrónico"
                className="rx-input"
              />
            </label>

            <label className="rx-field">
              <span className="rx-label">Contraseña</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="rx-input"
              />
            </label>

            {error && (
              <div className="rx-login-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rx-btn rx-btn--accent rx-login-submit"
            >
              {loading ? "Verificando..." : "Ingresar al sistema"}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}