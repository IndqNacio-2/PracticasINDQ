import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // login() habla con el backend real; lanza el error si las credenciales
      // son incorrectas o el usuario está inactivo.
      const ok = await login(correo, password);
      if (ok) navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #111827 0%, #1e293b 50%, #111827 100%)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F3F4F6]0 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-white font-bold text-xl" style={{ fontFamily: 'DM Sans, sans-serif' }}>GymFit</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            Gestión inteligente<br />de tu gimnasio.
          </h1>
          <p className="text-gray-400 text-lg">
            Control completo de membresías, clases, reservaciones e inventario desde un solo lugar.
          </p>
        </div>

        <p className="text-gray-600 text-sm">© GymFit · Sistema de Gestión</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-xl bg-[#F3F4F6]0 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-gray-900 font-bold text-lg" style={{ fontFamily: 'DM Sans, sans-serif' }}>GymFit</span>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>Iniciar sesión</h2>
            <p className="text-gray-500 text-sm">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
              <input
                type="email" value={correo} onChange={e => setCorreo(e.target.value)}
                placeholder="usuario@gymfit.mx" required
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827] focus:border-transparent"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-xl">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-[#111827] hover:bg-[#6B7280] text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Verificando...' : 'Ingresar al sistema'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}