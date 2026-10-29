import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";

import Dashboard from "./pages/dashboard";
import Attendance from "./pages/asistencia";

function App() {
  return (
    <AuthProvider>
      {/* basename: esta sección vive en su propia dirección (/cobro) dentro
          de la misma aplicación, sin enlazarse con las demás secciones. */}
      <Router basename="/cobro">
        <Routes>
          <Route path="/asistencia" element={<Attendance />} />

          {/* Ruta protegida*/}
          <Route
            path="/front-desk/dashboard"
            element={
              <ProtectedRoute allowedRoles={['recepcion']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/front-desk/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;