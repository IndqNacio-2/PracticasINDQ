import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles/nuucleo.css';
import './styles/extensiones.css';
import { FeedbackProvider } from './ui/kit';
import { AppShell } from './shell/AppShell';
import Login from './pages/Login';
import { inicioDe, usuarioGuardado, type Modulo } from './lib/session';

const PAGINAS: Record<Modulo, React.LazyExoticComponent<() => React.ReactElement>> = {
  dashboard: lazy(() => import('./pages/Dashboard')),
  recepcion: lazy(() => import('./pages/Recepcion')),
  venta: lazy(() => import('./pages/Venta')),
  usuarios: lazy(() => import('./pages/Usuarios')),
  clientes: lazy(() => import('./pages/Clientes')),
  clases: lazy(() => import('./pages/Clases')),
  membresias: lazy(() => import('./pages/Membresias')),
  reservaciones: lazy(() => import('./pages/Reservaciones')),
  inventario: lazy(() => import('./pages/Inventario')),
  movimientos: lazy(() => import('./pages/Movimientos')),
  merma: lazy(() => import('./pages/Merma')),
  corte: lazy(() => import('./pages/Corte')),
  reportes: lazy(() => import('./pages/Reportes')),
  checador: lazy(() => import('./pages/Checador')),
};

function Inicio() {
  const u = usuarioGuardado();
  return <Navigate to={u ? inicioDe(u.rol) : '/login'} replace />;
}

// Direcciones anteriores (administrativa, cobro y punto de venta) → módulos nuevos.
const ANTERIORES: [string, string][] = [
  ['/administrativa/login', '/login'], ['/cobro/front-desk/login', '/login'],
  ['/administrativa/dashboard', '/dashboard'], ['/administrativa/usuarios', '/usuarios'], ['/administrativa/clientes', '/clientes'],
  ['/administrativa/clases-horarios', '/clases'], ['/administrativa/membresias', '/membresias'], ['/administrativa/reservaciones', '/reservaciones'],
  ['/administrativa/productos', '/inventario'], ['/administrativa/mermas', '/merma'], ['/administrativa/reportes', '/reportes'],
  ['/cobro/front-desk/dashboard', '/recepcion'], ['/cobro/front-desk/clientes', '/clientes'], ['/cobro/front-desk/membresias', '/membresias'],
  ['/cobro/front-desk/clases-horarios', '/clases'], ['/cobro/front-desk/inventario', '/inventario'], ['/cobro/asistencia', '/checador'],
];

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FeedbackProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/login" element={<Login />} />
          {ANTERIORES.map(([de, a]) => <Route key={de} path={de} element={<Navigate to={a} replace />} />)}
          {(Object.keys(PAGINAS) as Modulo[]).map((m) => {
            const Pagina = PAGINAS[m];
            return (
              <Route key={m} path={`/${m}`} element={
                <AppShell modulo={m}>
                  <Suspense fallback={<div className="dempty"><span className="nu-spin" />Cargando…</div>}><Pagina /></Suspense>
                </AppShell>
              } />
            );
          })}
          <Route path="*" element={<Inicio />} />
        </Routes>
      </BrowserRouter>
    </FeedbackProvider>
  </React.StrictMode>,
);
