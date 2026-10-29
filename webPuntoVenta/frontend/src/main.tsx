import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import LoginPage from './auth/LoginPage'
import ModuleGuard from './auth/ModuleGuard'
import { LOGIN_PATH } from './auth/session'

// Las tres secciones viven en la misma aplicación y comparten la sesión.
//   /administrativa/login -> acceso único del personal
//   /                  -> Punto de Venta (solo vendedor)
//   /administrativa/*  -> sección webAdministrativa
//   /cobro/*           -> sección webCobro
import WebAdministrativaSection from './sections/webAdministrativa/Section'
import WebCobroSection from './sections/webCobro/Section'

// Decide qué aplicación mostrar según la dirección abierta en el navegador.
const legacyLoginPaths = ['/login', '/cobro/front-desk/login']
const path = window.location.pathname
const isLogin = path === LOGIN_PATH || legacyLoginPaths.includes(path)
let content: React.ReactNode

if (legacyLoginPaths.includes(path)) {
  window.history.replaceState({}, '', LOGIN_PATH)
}

if (isLogin) {
  content = <LoginPage />
} else if (path.startsWith('/administrativa')) {
  content = (
    <ModuleGuard allowedRole="administrador">
      <WebAdministrativaSection />
    </ModuleGuard>
  )
} else if (path.startsWith('/cobro')) {
  content = (
    <ModuleGuard allowedRole="recepcion">
      <WebCobroSection />
    </ModuleGuard>
  )
} else {
  content = (
    <ModuleGuard allowedRole="vendedor">
      <App />
    </ModuleGuard>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{content}</React.StrictMode>,
)
