import { useState } from "react"

interface Props {
  token: string
  onFinish: (message: string) => void
}

export default function CambiarPassword({ token, onFinish }: Props) {
  const [actual, setActual] = useState("")
  const [nueva, setNueva] = useState("")
  const [confirmacion, setConfirmacion] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loading) return
    setError("")
    if (nueva.length < 8 || new TextEncoder().encode(nueva).length > 72) {
      setError("La nueva contraseña debe tener al menos 8 caracteres y no superar 72 bytes.")
      return
    }
    if (nueva !== confirmacion || nueva === actual) {
      setError("La confirmación debe coincidir y la nueva contraseña debe ser distinta a la actual.")
      return
    }
    setLoading(true)
    try {
      const response = await fetch("/admin/api/auth/cambiar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ passwordActual: actual, passwordNueva: nueva }),
      })
      const data = await response.json() as { message?: string }
      if (!response.ok) throw new Error(data.message ?? "No se pudo cambiar la contraseña.")
      onFinish("Contraseña actualizada. Inicia sesión con tu nueva contraseña.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="rx-login-form" aria-busy={loading}>
      <label className="rx-field">
        <span className="rx-label">Contraseña actual</span>
        <input type="password" required autoComplete="current-password" value={actual} onChange={e => setActual(e.target.value)} className="rx-input" />
      </label>
      <label className="rx-field">
        <span className="rx-label">Nueva contraseña</span>
        <input type="password" required minLength={8} autoComplete="new-password" value={nueva} onChange={e => setNueva(e.target.value)} className="rx-input" />
      </label>
      <label className="rx-field">
        <span className="rx-label">Confirma la nueva contraseña</span>
        <input type="password" required minLength={8} autoComplete="new-password" value={confirmacion} onChange={e => setConfirmacion(e.target.value)} className="rx-input" />
      </label>
      {error && <div className="rx-login-error" role="alert">{error}</div>}
      <button type="submit" disabled={loading} className="rx-btn rx-btn--accent rx-login-submit">{loading ? "Guardando..." : "Guardar contraseña"}</button>
      <button type="button" disabled={loading} className="rx-btn" onClick={() => onFinish("")}>Volver al inicio de sesión</button>
    </form>
  )
}