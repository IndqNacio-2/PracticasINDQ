import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";

import Login from "./pages/login";
import Dashboard from "./pages/dashboard";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Ruta pública: cualquiera puede ver el login */}
          <Route path="/front-desk/login" element={<Login />} />

          {/* Ruta protegida: SOLO usuarios con rol "recepción" */}
          <Route
            path="/front-desk/dashboard"
            element={
              <ProtectedRoute allowedRoles={['recepción']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/front-desk/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;