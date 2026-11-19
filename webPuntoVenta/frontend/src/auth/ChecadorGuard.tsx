import { useEffect, useState, type ReactNode } from 'react'
import { TOKEN_KEY } from './session'

export default function ChecadorGuard({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<'cargando' | 'autorizado' | 'denegado'>('cargando')
  useEffect(() => {
    const controller = new AbortController()
    fetch('/cobro/api/checador/acceso', {
      headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}` },
      signal: controller.signal,
    }).then(response => {
      if (!controller.signal.aborted) setEstado(response.ok ? 'autorizado' : 'denegado')
    }).catch(() => {
      if (!controller.signal.aborted) setEstado('denegado')
    })
    return () => controller.abort()
  }, [])
  if (estado === 'cargando') return <p role="status">Validando acceso al checador…</p>
  if (estado === 'denegado') return <main><h1>Acceso restringido</h1><p>Se requiere un usuario autorizado exclusivamente para operar el checador.</p></main>
  return children
}