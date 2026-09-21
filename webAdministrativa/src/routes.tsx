import { createBrowserRouter, Navigate } from 'react-router';
import { ProtectedLayout } from './components/ProtectedLayout';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { UsuariosPage } from './features/usuarios/UsuariosPage';
import { ClientesPage } from './features/clientes/ClientesPage';
import { ClienteDetalle } from './features/clientes/ClienteDetalle';
import { ClasesPage } from './features/clases/ClasesPage';
import { HorariosPage } from './features/horarios/HorariosPage';
import { ReservacionesPage } from './features/reservaciones/ReservacionesPage';
import { ProductosPage } from './features/productos/ProductosPage';
import { ReportesPage } from './features/reportes/ReportesPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: LoginPage,
  },
  {
    path: '/',
    Component: ProtectedLayout,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', Component: DashboardPage },
      { path: 'usuarios', Component: UsuariosPage },
      { path: 'clientes', Component: ClientesPage },
      { path: 'clientes/:id', Component: ClienteDetalle },
      { path: 'clases', Component: ClasesPage },
      { path: 'horarios', Component: HorariosPage },
      { path: 'reservaciones', Component: ReservacionesPage },
      { path: 'productos', Component: ProductosPage },
      { path: 'reportes', Component: ReportesPage },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);
