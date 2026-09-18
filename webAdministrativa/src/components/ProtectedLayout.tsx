import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Layout } from './Layout';

export function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}
