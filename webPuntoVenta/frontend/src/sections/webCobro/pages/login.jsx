import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';

// Mock para probar el Login
const MOCK_USERS = [
  { email: 'admin@gymfit.mx', password: '123456', role: 'administrador', name: 'Admin GymFit' },
  { email: 'recepcion@gymfit.mx', password: '123456', role: 'recepción', name: 'Recepción GymFit' },
  { email: 'anagar@gymfit.mx', password: '123456', role: 'recepción', name: 'Ana Garcia' },
];

export default function Login() {

  // Aquí guardamos lo que el usuario escribe y el estado de la interfaz.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // Para el mensaje de error

  const { login } = useAuth();
  const navigate = useNavigate();

  
  const handleSubmit = async (e) => {
    e.preventDefault(); // Evita que la página se recargue
    setError(null); // Limpia errores anteriores
    setLoading(true);  // Prepara el botón para "pensar"

    try {
      // Si el correo no tiene @ o la contraseña es muy corta.
      if (!email.includes('@') || !email.includes('.')) {
        throw new Error('El correo electrónico no es válido.');
      }
      if (password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
      }

      // Buscamos al usuario en nuestra "base de datos" falsa.
      const user = MOCK_USERS.find(
        u => u.email === email && u.password === password
      );

      // Si no lo encuentra, lanzamos un error para capturar en el CATCH.
      if (!user) {
        throw new Error('Correo o contraseña incorrectos.');
      }
      // Guardamos al usuario en el contexto global.
      login(user);
      // Lo mandamos a otra pantalla.
      navigate('/front-desk/dashboard');

    } catch (error) {
      // Si algo en el try falló (validación o usuario incorrecto)
      setError(error.message); // Mostramos el mensaje al usuario.
    } finally {
      setLoading(false); // Apagamos el botón de "cargando".
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-dark-900">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Encabezado */}
        <div className="p-8 border-b border-gray-100">
          <h2 className="text-3xl font-bold text-gray-800">Iniciar sesión</h2>
          <p className="text-gray-500 mt-1 text-sm">
            Ingresa tus credenciales para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          
          {/* Mensaje de error visual */}
          {error && (
            <div className="flex items-center p-4 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-sm">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{error}</span>
            </div>
          )}

          {/* Campo Correo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="email"
                required
                placeholder="usuario@gymfit.mx"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 block w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-gray-800"
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 block w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-gray-800"
              />
            </div>
          </div>

          {/* Botón de Enviar */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-white font-medium bg-primary hover:bg-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Autenticando...' : <>Ingresar al sistema <ArrowRight className="ml-2 h-5 w-5" /></>}
          </button>

          <button
            type="button"
            onClick={() => alert('Flujo de recuperación de contraseña...')}
            className="w-full text-sm text-primary hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </form>
      </div>
    </div>
  );
}