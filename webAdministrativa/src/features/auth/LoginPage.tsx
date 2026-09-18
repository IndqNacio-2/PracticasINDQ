import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';

const DEMO_USERS = [
  { correo: 'admin@gymfit.mx', rol: 'Administrador', pass: 'admin123' },
  { correo: 'entrenador@gymfit.mx', rol: 'Entrenador', pass: 'entrenador123' },
  { correo: 'recepcion@gymfit.mx', rol: 'Recepción', pass: 'recepcion123' },
];

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
    await new Promise(r => setTimeout(r, 500));
    const ok = login(correo, password);
    setLoading(false);
    if (ok) navigate('/dashboard');
    else setError('Credenciales incorrectas o usuario inactivo.');
  };

  const fillDemo = (d: typeof DEMO_USERS[0]) => {
    setCorreo(d.correo);
    setPassword(d.pass);
    setError('');
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
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
          <p className="text-slate-400 text-lg">
            Control completo de membresías, clases, reservaciones e inventario desde un solo lugar.
          </p>
        </div>

        <p className="text-slate-600 text-sm">© GymFit · Sistema de Gestión</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-slate-900 font-bold text-lg" style={{ fontFamily: 'DM Sans, sans-serif' }}>GymFit</span>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>Iniciar sesión</h2>
            <p className="text-slate-500 text-sm">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo electrónico</label>
              <input
                type="email" value={correo} onChange={e => setCorreo(e.target.value)}
                placeholder="usuario@gymfit.mx" required
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Verificando...' : 'Ingresar al sistema'}
            </button>
          </form>

          <div className="mt-6">
            <p className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">Accesos de demostración</p>
            <div className="space-y-2">
              {DEMO_USERS.map(d => (
                <button key={d.correo} type="button" onClick={() => fillDemo(d)}
                  className="w-full text-left flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors group">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{d.rol}</p>
                    <p className="text-xs text-slate-400">{d.correo}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}