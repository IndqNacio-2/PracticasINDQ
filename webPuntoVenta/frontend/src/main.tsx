import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Secciones con el trabajo de los compañeros del equipo, montadas dentro de
// esta misma aplicación pero SIN conectarse entre sí: no hay botones que
// salten de una a otra, y cada una tiene su propia dirección y su propio
// estado.
//   /                  -> aplicación de Punto de Venta (este proyecto)
//   /administrativa/*  -> sección webAdministrativa
//   /cobro/*           -> sección webCobro
import WebAdministrativaSection from './sections/webAdministrativa/Section'
import WebCobroSection from './sections/webCobro/Section'

// Decide qué aplicación mostrar según la dirección abierta en el navegador.
const path = window.location.pathname
let content: React.ReactNode = <App />
if (path.startsWith('/administrativa')) {
  content = <WebAdministrativaSection />
} else if (path.startsWith('/cobro')) {
  content = <WebCobroSection />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{content}</React.StrictMode>,
)
