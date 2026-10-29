import { createContext, useContext, useState } from 'react';
import { clearSession, getStoredUser } from '../../../auth/session';
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser);

  // Función para iniciar sesión: recibe el usuario encontrado en el Login
  const login = (userData) => {
    setUser(userData);
  };

  // Función para cerrar sesión: borra al usuario
  const logout = () => {
    setUser(null);
    clearSession();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children} {/* Aquí vive todo tu App.jsx */}
    </AuthContext.Provider>
  );
};


export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
};