import { useState } from "react"
import { getModulePath, saveSession, type SessionUser } from "./session"

interface CambiarPasswordProps {
  token: string
  user: SessionUser
  passwordActual: string
}

/** Formulario para cambiar la contraseña temporal en el primer inicio de sesión. */
export default function CambiarPassword({ token, user, passwordActual }: CambiarPasswordProps) {
  const [nueva, setNueva] = useState("")
  const [confirmacion, setConfirmacion] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")

    if (nueva.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.")
      return
    }
    if (nueva !== confirmacion) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/admin/api/auth/cambiar-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ passwordActual, passwordNueva: nueva }),
      })

      const data = (await response.json()) as { user?: SessionUser; message?: string }
      if (!response.ok || !data.user) {
        throw new Error(data.message ?? "No se pudo cambiar la contraseña.")
      }

      // La sesión se guarda hasta aquí: sin cambiar la contraseña no se entra.
      saveSession(token, data.user)
      window.location.assign(getModulePath(data.user.rol) ?? "/")
    } catch (cambioError) {
      setError(cambioError instanceof Error ? cambioError.message : "No se pudo cambiar la contraseña.")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rx-login-form" aria-busy={loading}>
      <p className="rx-help-text">Hola, {user.nombre}. Tu contraseña es temporal: elige una nueva para continuar.</p>

      <label className="rx-field">
        <span className="rx-label">Nueva contraseña</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={nueva}
          onChange={(event) => setNueva(event.target.value)}
          className="rx-input"
        />
      </label>

      <label className="rx-field">
        <span className="rx-label">Confirma la contraseña</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirmacion}
          onChange={(event) => setConfirmacion(event.target.value)}
          className="rx-input"
        />
      </label>

      {error && (
        <div className="rx-login-error" role="alert">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} className="rx-btn rx-btn--accent rx-login-submit">
        {loading ? "Guardando..." : "Guardar y continuar"}
      </button>
    </form>
  )
}
