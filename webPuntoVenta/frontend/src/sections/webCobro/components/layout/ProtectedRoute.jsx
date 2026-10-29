import { useAuth } from '../../context/AuthContext';
import { LOGIN_PATH } from '../../../../auth/session';

// IMPORTANTE: El nombre debe ser EXACTAMENTE 'ProtectedRoute'
export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user } = useAuth();

  // Si no hay usuario logueado, redirige al login
  if (!user) {
    window.location.replace(LOGIN_PATH);
    return null;
  }

  // Si hay roles permitidos y el usuario no tiene el correcto, redirige
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.rol)) {
    window.location.replace(LOGIN_PATH);
    return null;
  }

  // Si todo está bien, muestra el contenido (children)
  return children;
};