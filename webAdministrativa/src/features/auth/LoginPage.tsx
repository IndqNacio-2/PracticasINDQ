import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { mensajeDeError } from '../../lib/api';

const PAGE_BACKGROUND = {
  background: 'linear-gradient(135deg, #16181D 0%, #23262D 50%, #16181D 100%)',
} as const;

const INPUT_CLASS =
  'w-full px-4 py-2.5 text-sm border border-[color:var(--line)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)] focus:border-transparent';

/* ───────────── Subcomponentes ───────────── */

function LogoMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'md' ? 'w-10 h-10' : 'w-8 h-8';
  const icon = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <div className={`${box} rounded-xl bg-[color:var(--accent)] flex items-center justify-center`}>
      <svg className={`${icon} text-[color:var(--ink)]`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="hidden lg:flex flex-col justify-between w-2/5 p-12">
      <div className="flex items-center gap-3">
        <LogoMark />
        <span className="text-white font-bold text-xl">GymFit</span>
      </div>

      <div>
        <h1 className="text-4xl font-bold text-white leading-tight mb-4">
          Gestión inteligente<br />de tu gimnasio.
        </h1>
        <p className="text-[color:var(--ink3)] text-lg">
          Control completo de membresías, clases, reservaciones e inventario desde un solo lugar.
        </p>
      </div>

      <p className="text-[color:var(--ink2)] text-sm">© GymFit · Sistema de Gestión</p>
    </aside>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 text-sm text-[color:var(--bad)] bg-[color:var(--bad-bg)] border border-[color:var(--bad-bg)] px-3 py-2.5 rounded-xl"
    >
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      {message}
    </div>
  );
}

interface LoginFormProps {
  correo: string;
  password: string;
  error: string;
  loading: boolean;
  onCorreoChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}

function LoginForm({
  correo,
  password,
  error,
  loading,
  onCorreoChange,
  onPasswordChange,
  onSubmit,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="correo" className="block text-sm font-medium text-[color:var(--ink)] mb-1.5">
          Correo electrónico
        </label>
        <input
          id="correo"
          type="email"
          value={correo}
          onChange={e => onCorreoChange(e.target.value)}
          placeholder="usuario@gymfit.mx"
          autoComplete="email"
          required
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-[color:var(--ink)] mb-1.5">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={e => onPasswordChange(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
          className={INPUT_CLASS}
        />
      </div>

      {error && <ErrorAlert message={error} />}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[color:var(--dark)] hover:bg-[color:var(--dark2)] text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {loading ? 'Verificando...' : 'Ingresar al sistema'}
      </button>
    </form>
  );
}

/* ───────────── Página ───────────── */

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(correo, password);
      navigate('/dashboard');
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo iniciar sesión. Intenta de nuevo.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={PAGE_BACKGROUND}>
      <BrandPanel />

      <main className="flex-1 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
          {/* Logo visible solo en móvil (el panel lateral se oculta) */}
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <LogoMark size="sm" />
            <span className="text-[color:var(--ink)] font-bold text-lg">GymFit</span>
          </div>

          <header className="mb-7">
            <h2 className="text-2xl font-bold text-[color:var(--ink)] mb-1">
              Iniciar sesión
            </h2>
            <p className="text-[color:var(--ink2)] text-sm">Ingresa tus credenciales para continuar</p>
          </header>

          <LoginForm
            correo={correo}
            password={password}
            error={error}
            loading={loading}
            onCorreoChange={setCorreo}
            onPasswordChange={setPassword}
            onSubmit={handleSubmit}
          />
        </div>
      </main>
    </div>
  );
}