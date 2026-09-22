import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// ✅ IMPORTANTE: El nombre debe ser EXACTAMENTE 'ProtectedRoute'
export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user } = useAuth();

  // Si no hay usuario logueado, redirige al login
  if (!user) {
    return <Navigate to="/front-desk/login" replace />;
  }

  // Si hay roles permitidos y el usuario no tiene el correcto, redirige
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // Si todo está bien, muestra el contenido (children)
  return children;
};