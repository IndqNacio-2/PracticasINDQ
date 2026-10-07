import { useState, useEffect } from 'react';
import { Clock, CheckCircle, User, AlertTriangle, LogIn, LogOut } from 'lucide-react';

const Attendance = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [codigo, setCodigo] = useState('');
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [historialUsuario, setHistorialUsuario] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const API = 'http://localhost:3001';

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Buscar usuario por código
  const buscarUsuario = async (codigoIngresado) => {
    if (!codigoIngresado.trim()) {
      setUsuarioActual(null);
      setHistorialUsuario([]);
      return;
    }

    setLoadingSearch(true);
    try {
      // Buscar en clientes
      const clientesRes = await fetch(`${API}/api/clientes`);
      const clientes = await clientesRes.json();
      const clienteEncontrado = clientes.find(c => String(c.id) === codigoIngresado.trim());

      if (clienteEncontrado) {
        setUsuarioActual({
          tipo: 'cliente',
          id: clienteEncontrado.id,
          codigo: `CLI-${clienteEncontrado.id}`,
          nombre: clienteEncontrado.nombre,
          membresia: clienteEncontrado.membresia
        });
        cargarHistorialUsuario(`CLI-${clienteEncontrado.id}`);
        return;
      }

      // Buscar empleado por código (formato EMP-XXX)
      if (codigoIngresado.toUpperCase().startsWith('EMP-')) {
        setUsuarioActual({
          tipo: 'empleado',
          codigo: codigoIngresado.toUpperCase(),
          nombre: 'Empleado Registrado',
          rol: 'Empleado'
        });
        cargarHistorialUsuario(codigoIngresado.toUpperCase());
        return;
      }

      setUsuarioActual(null);
      setHistorialUsuario([]);
      setResultado({ 
        exitoso: false, 
        msg: 'Código no encontrado en el sistema' 
      });

    } catch (error) {
      console.error('Error buscando usuario:', error);
      setResultado({ 
        exitoso: false, 
        msg: 'Error al buscar el usuario' 
      });
    } finally {
      setLoadingSearch(false);
    }
  };

  // Cargar historial del usuario
  const cargarHistorialUsuario = async (identificador) => {
    try {
      const res = await fetch(`${API}/api/asistencia/historial/${encodeURIComponent(identificador)}`);
      if (res.ok) {
        const data = await res.json();
        setHistorialUsuario(data.slice(0, 10)); // Últimos 10 registros
      } else {
        setHistorialUsuario([]);
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
      setHistorialUsuario([]);
    }
  };

  // Manejar el marcado
  const manejarMark = async () => {
    if (!usuarioActual) return;

    setResultado(null);

    try {
      const res = await fetch(`${API}/api/asistencia/marcar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: usuarioActual.codigo })
      });

      const data = await res.json();

      if (!res.ok) {
        setResultado({ 
          exitoso: false, 
          msg: data.error || 'Error desconocido' 
        });
        return;
      }

      setResultado({
        exitoso: true,
        tipo: data.tipo,
        msg: `${data.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Salida'} registrada correctamente`
      });

      // Recargar historial
      setTimeout(() => {
        cargarHistorialUsuario(usuarioActual.codigo);
      }, 500);

    } catch (error) {
      console.error('Error al marcar asistencia:', error);
      setResultado({ 
        exitoso: false, 
        msg: 'No se pudo conectar con el servidor' 
      });
    }
  };

  // Determinar siguiente acción
  const ultimoRegistro = historialUsuario.length > 0 ? historialUsuario[0] : null;
  const proximaAccion = !ultimoRegistro || ultimoRegistro.tipo === 'salida' ? 'entrada' : 'salida';

  const horaFormateada = currentTime.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const fechaFormateada = currentTime.toLocaleDateString('es-MX', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });

  return (
    <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 font-sans">
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-emerald-500 p-4 text-white text-center">
          <h1 className="text-2xl font-bold">GymFit Checador</h1>
          <p className="opacity-90 text-sm">Sistema de Registro de Asistencia</p>
        </div>

        <div className="p-6">
          
          {/* Reloj */}
          <div className="text-center mb-6 bg-slate-50 p-4 rounded-xl">
            <div className="flex items-center justify-center gap-2 text-slate-500 text-xs uppercase mb-1">
              <Clock size={14} /> Hora del Sistema
            </div>
            <div className="text-4xl font-bold text-slate-800 tabular-nums">
              {horaFormateada}
            </div>
            <div className="text-slate-500 text-sm mt-1">
              {fechaFormateada}
            </div>
          </div>

          {/* Input de código */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Ingresa tu código de acceso
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="text-slate-400" size={20} />
              </div>
              <input
                type="text"
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value.toUpperCase());
                  buscarUsuario(e.target.value.toUpperCase());
                  setResultado(null);
                }}
                placeholder="Ej: 1 (cliente) o EMP-101 (empleado)"
                className="w-full pl-10 pr-4 py-3 text-lg border-2 border-slate-200 rounded-lg 
                           focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 
                           transition-all uppercase placeholder:text-xs placeholder:uppercase"
                autoFocus
              />
            </div>
          </div>

          {/* Información del usuario encontrado */}
          {loadingSearch && (
            <div className="text-center text-slate-500 text-sm py-4">Buscando...</div>
          )}

          {usuarioActual && !loadingSearch && (
            <div className="mb-6 bg-emerald-50 border-2 border-emerald-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-semibold">Usuario Encontrado</p>
                  <p className="text-2xl font-bold text-slate-800">{usuarioActual.nombre}</p>
                  <p className="text-sm text-slate-600 mt-1">
                    {usuarioActual.tipo === 'cliente' 
                      ? `Membresía: ${usuarioActual.membresia}` 
                      : 'Empleado del Sistema'}
                  </p>
                </div>
              </div>

              {/* Último registro */}
              {ultimoRegistro && (
                <div className="mb-4 p-3 bg-white rounded border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase mb-1">Último registro</p>
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${
                      ultimoRegistro.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {ultimoRegistro.tipo === 'entrada' ? '🟢 ENTRADA' : '🔴 SALIDA'}
                    </span>
                    <span className="text-sm text-slate-600">
                      {new Date(ultimoRegistro.ts).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              )}

              {/* Botón de marcar */}
              <button
                onClick={manejarMark}
                className={`w-full py-3 rounded-lg text-white font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                  proximaAccion === 'entrada'
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {proximaAccion === 'entrada' ? (
                  <>
                    <LogIn size={18} /> MARCAR ENTRADA
                  </>
                ) : (
                  <>
                    <LogOut size={18} /> MARCAR SALIDA
                  </>
                )}
              </button>
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div className={`mb-6 p-3 rounded-lg flex items-start gap-2 text-sm ${
              resultado.exitoso 
                ? 'bg-emerald-50 border border-emerald-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {resultado.exitoso ? (
                <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
              ) : (
                <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
              )}
              <p className={resultado.exitoso ? 'text-emerald-800' : 'text-red-800'}>
                {resultado.msg}
              </p>
            </div>
          )}

          {/* Historial del usuario */}
          {usuarioActual && historialUsuario.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Historial de Registros
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {historialUsuario.map((reg, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        reg.tipo === 'entrada' ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                      <span className={`text-xs font-semibold ${
                        reg.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {reg.tipo === 'entrada' ? 'ENTRADA' : 'SALIDA'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(reg.ts).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {codigo && !usuarioActual && !loadingSearch && (
            <div className="text-center text-slate-400 text-sm py-4">
              Código no encontrado
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-2 text-center text-xs text-slate-400">
          GymFit — Modulo de Asistencia
        </div>
      </div>
    </div>
  );
};

export default Attendance;