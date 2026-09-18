import { createBrowserRouter, Navigate } from 'react-router';
import { ProtectedLayout } from './components/ProtectedLayout';
import { LoginPage } from './features/auth/LoginPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: LoginPage,
  },
  {
    path: '/',
    Component: ProtectedLayout,
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);