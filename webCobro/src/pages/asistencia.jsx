import  { useState, useEffect } from 'react';
import { Clock, CheckCircle,  User, AlertTriangle } from 'lucide-react';

const Attendance = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState(null); // { tipo, msg, exitoso }
  const [historial, setHistorial] = useState([]);

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Manejar el marcado
  const manejarMark = async () => {
    setResultado(null);

    try {
      const res = await fetch('http://localhost:3001/api/asistencia/marcar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigo.trim().toUpperCase() })
      });

      const data = await res.json();

      if (!res.ok) {
        setResultado({ exitoso: false, tipo: null, msg: data.error || 'Error desconocido' });
        return;
      }

      // Éxito: agregar al historial
      const nuevoRegistro = {
        id: data._id || Date.now(),
        codigo: data.codigo,
        nombre: data.nombre,
        tipo: data.tipo, // 'entrada' o 'salida'
        hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      };

      setHistorial(prev => [nuevoRegistro, ...prev].slice(0, 15));
      setResultado({
        exitoso: true,
        tipo: data.tipo,
        msg: `${data.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Salida'} registrada correctamente`
      });
      setCodigo(''); // Limpiar input

    } catch {
      setResultado({ exitoso: false, tipo: null, msg: 'No se pudo conectar con el servidor.' });
    }
  };

  // Formateo de fecha/hora
  const horaFormateada = currentTime.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const fechaFormateada = currentTime.toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 font-sans">
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-emerald-500 p-6 text-white text-center">
          <h1 className="text-3xl font-bold">GymFit Checador de Asistencia</h1>
          <p className="opacity-90 mt-1">Registro de Asistencia</p>
        </div>

        <div className="p-8">
          
          {/* Reloj Grande */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm uppercase tracking-widest mb-2">
              <Clock size={16} /> Hora del Sistema
            </div>
            <div className="text-6xl font-bold text-slate-800 tracking-tighter tabular-nums">
              {horaFormateada}
            </div>
            <div className="text-slate-500 capitalize mt-1 text-lg">
              {fechaFormateada}
            </div>
          </div>

          {/* Input + Botón */}
          <div className="flex flex-col gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="text-slate-400" size={24} />
              </div>
              <input
                type="text"
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value);
                  setResultado(null); // Limpiar resultado al escribir
                }}
                placeholder="CÓDIGO DE EMPLEADO (ej. EMP-101)"
                className="w-full pl-12 pr-4 py-4 text-xl border-2 border-slate-200 rounded-xl 
                           focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 
                           transition-all text-center tracking-[0.3em] uppercase placeholder:tracking-normal"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') manejarMark();
                }}
                autoFocus
              />
            </div>

            <button
              onClick={manejarMark}
              disabled={!codigo.trim()}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 
                         disabled:cursor-not-allowed text-white text-lg font-semibold rounded-xl
                         transition-all shadow-lg hover:shadow-emerald-500/30 active:scale-[0.98]"
            >
              MARCAR ASISTENCIA
            </button>
          </div>

          {/* Resultado / Notificación */}
          {resultado && (
            <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 ${
              resultado.exitoso 
                ? 'bg-emerald-50 border border-emerald-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {resultado.exitoso ? (
                <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={24} />
              ) : (
                <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={24} />
              )}
              <div>
                <p className={`font-semibold ${
                  resultado.exitoso ? 'text-emerald-800' : 'text-red-800'
                }`}>
                  {resultado.msg}
                </p>
                {resultado.tipo && (
                  <p className={`text-sm mt-1 ${
                    resultado.tipo === 'entrada' ? 'text-emerald-700' : 'text-red-700'
                  }`}>
                    {resultado.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Salida'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Historial reciente */}
          {historial.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <h3 className="text-sm text-slate-500 uppercase tracking-widest mb-3">
                Registros Recientes
              </h3>
              <div className="space-y-2">
                {historial.map((reg) => (
                  <div key={reg.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        reg.tipo === 'entrada' ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                      <span className="text-sm font-medium text-slate-700">
                        {reg.nombre || reg.codigo}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className={`font-semibold ${
                        reg.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {reg.tipo === 'entrada' ? 'ENTRADA' : 'SALIDA'}
                      </span>
                      <span>{reg.hora}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-3 text-center text-xs text-slate-400">
          GymFit — Sistema de Gestión • Módulo de Asistencia
        </div>
      </div>
    </div>
  );
};

export default Attendance;