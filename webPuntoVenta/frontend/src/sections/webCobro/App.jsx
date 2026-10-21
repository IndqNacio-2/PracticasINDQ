import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";

import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import Attendance from "./pages/asistencia";

function App() {
  return (
    <AuthProvider>
      {/* basename: esta sección vive en su propia dirección (/cobro) dentro
          de la misma aplicación, sin enlazarse con las demás secciones. */}
      <Router basename="/cobro">
        <Routes>
          {/* Ruta pública */}
          <Route path="/front-desk/login" element={<Login />} />
          <Route path="/asistencia" element={<Attendance />} />

          {/* Ruta protegida*/}
          <Route
            path="/front-desk/dashboard"
            element={
              <ProtectedRoute allowedRoles={['recepción','admin', 'entrenador']}>
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