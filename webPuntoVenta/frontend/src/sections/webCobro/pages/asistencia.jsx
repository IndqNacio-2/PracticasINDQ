import { useState, useEffect, useRef } from 'react';
import { CheckCircle, User, AlertTriangle, LogIn, LogOut, History } from 'lucide-react';

// Formatos que entiende el checador: EMP-101, CLI-3 o el id del socio (3)
const listoBuscar = (cod) =>
  /^\d+$/.test(cod) || /^CLI-\d+$/.test(cod) || /^EMP-\d{3}$/.test(cod);

// Normaliza igual que el backend: "3" -> "CLI-3"; CLI-x y EMP-x tal cual
const normalizar = (cod) => (/^\d+$/.test(cod) ? `CLI-${cod}` : cod);

const Attendance = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState(null); // { msg, exitoso }
  const [historial, setHistorial] = useState([]);   // ultimos 10 registros de la persona
  const [empleado, setEmpleado] = useState(null);   // persona consultada (null si no hay)
  const [cargando, setCargando] = useState(false);
  const busqRef = useRef(0);                        // descarta respuestas viejas

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Busqueda incremental: al escribir el codigo busca al socio/empleado
  useEffect(() => {
    const cod = codigo.trim().toUpperCase();
    if (!cod) {
      busqRef.current += 1; // cancela cualquier busqueda en vuelo
      setEmpleado(null);
      setHistorial([]);
      setResultado(null);
      setCargando(false);
      return;
    }
    const id = ++busqRef.current;
    const timer = setTimeout(() => buscar(cod, id), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);

  // Trae a la persona (empleado o socio) y sus ultimos 10 registros
  const buscar = async (cod, id) => {
    if (id !== busqRef.current) return; // respuesta vieja: se ignora

    if (!listoBuscar(cod)) {
      setEmpleado(null);
      setHistorial([]);
      if (cod.length >= 3) {
        setResultado({ exitoso: false, msg: 'Código no encontrado' });
      }
      return;
    }

    setCargando(true);
    try {
      const resPersona = await fetch(`/cobro/api/asistencia/empleado/${cod}`);
      if (id !== busqRef.current) return;
      if (resPersona.status === 404) {
        setEmpleado(null);
        setHistorial([]);
        const data = await resPersona.json();
        setResultado({ exitoso: false, msg: data.error || 'Código no encontrado' });
        return;
      }
      if (!resPersona.ok) throw new Error('fallo en la consulta');

      const persona = await resPersona.json();
      const resHistorial = await fetch(`/cobro/api/asistencia/historial/${cod}`);
      if (id !== busqRef.current) return;
      const registros = resHistorial.ok ? await resHistorial.json() : [];

      setEmpleado(persona);
      setHistorial(registros);
      setResultado(null);
    } catch {
      if (id === busqRef.current) {
        setResultado({ exitoso: false, msg: 'No se pudo conectar. Verifica tu conexión e intenta de nuevo.' });
      }
    } finally {
      if (id === busqRef.current) setCargando(false);
    }
  };

  // Registra entrada o salida con el boton que muestra el checador
  const marcar = async () => {
    if (!empleado) return;
    setResultado(null);

    try {
      const res = await fetch('/cobro/api/asistencia/marcar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: empleado.codigo })
      });

      const data = await res.json();
      if (!res.ok) {
        setResultado({ exitoso: false, tipo: null, msg: data.error || 'Error desconocido' });
        return;
      }

      // vuelve a traer historial y estado para refrescar pantalla y boton
      const [resEmpleado, resHistorial] = await Promise.all([
        fetch(`/cobro/api/asistencia/empleado/${empleado.codigo}`),
        fetch(`/cobro/api/asistencia/historial/${empleado.codigo}`),
      ]);
      if (resEmpleado.ok) setEmpleado(await resEmpleado.json());
      if (resHistorial.ok) setHistorial(await resHistorial.json());

      setResultado({
        exitoso: true,
        tipo: data.tipo,
        msg: `${data.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Salida'} registrada correctamente`
      });
    } catch {
      setResultado({ exitoso: false, tipo: null, msg: 'No se pudo conectar. Verifica tu conexión e intenta de nuevo.' });
    }
  };

  // Limpia todo para atender a otro codigo
  const limpiar = () => {
    setEmpleado(null);
    setHistorial([]);
    setCodigo('');
    setResultado(null);
  };

  // El boton marca solo si el codigo capturado es el mismo socio consultado;
  // si escribio otro codigo vuelve a ser de consulta
  const codActual = codigo.trim().toUpperCase();
  // Se puede marcar mientras el codigo capturado siga siendo la persona
  // consultada (compara normalizando: "1" == "CLI-1")
  const listoParaMarcar = Boolean(
    empleado && codActual && normalizar(codActual) === empleado.codigo
  );

  // Formateo de fecha/hora
  const horaFormateada = currentTime.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const fechaFormateada = currentTime.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  return (
    <div className="min-h-screen w-full bg-[#4B5563] flex items-center justify-center p-4 font-sans">
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        
        {/* Header con reloj compacto */}
        <div className="bg-dark-800 p-5 text-white flex items-center justify-between gap-4">
          <div className="text-left">
            <h1 className="text-2xl font-bold">GymFit Checador de Asistencia</h1>
            <p className="opacity-90 text-sm">Registro de Asistencia</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold tabular-nums">{horaFormateada}</div>
            <div className="text-xs opacity-90 capitalize">{fechaFormateada}</div>
          </div>
        </div>

        <div className="p-8">
          
          {/* El reloj vive ahora en el header */}
          {/* Input con busqueda incremental (se busca al escribir o con Enter) */}
          <div className="flex flex-col gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="text-[#6B7280]" size={24} />
              </div>
              <input
                type="text"
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value);
                  setResultado(null); // Limpiar resultado al escribir
                }}
                placeholder="Escanea o captura tu codigo (EMP-101 o id del socio)"
                className="w-full pl-12 pr-4 py-4 text-xl border-2 border-[#6B7280] rounded-xl
                           focus:outline-none focus:border-[#111827] focus:ring-4 focus:ring-[#111827]/20
                           transition-all text-center tracking-[0.3em] uppercase placeholder:tracking-normal"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && codigo.trim()) {
                    // busqueda inmediata (lectores de barras envian Enter)
                    buscar(codigo.trim().toUpperCase(), ++busqRef.current);
                  }
                }}
                autoFocus
              />
            </div>

            {cargando && !listoParaMarcar ? (
              <div className="py-3 text-center text-sm text-[#6B7280] animate-pulse">
                Buscando codigo...
              </div>
            ) : null}
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

          {/* Usuario encontrado + boton de entrada/salida */}
          {empleado && (
            <div className="mt-6 bg-[#F3F4F6] border-2 border-[#6B7280] rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs text-[#6B7280] uppercase font-semibold">Usuario Encontrado</p>
                  <p className="text-2xl font-bold text-[#111827]">{empleado.nombre}</p>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {empleado.tipo === 'cliente'
                      ? `Membresía: ${empleado.membresia}`
                      : `${empleado.rol || 'Empleado'} · ${empleado.codigo}`}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  empleado.siguienteTipo === 'salida'
                    ? 'bg-[#6B7280] text-white'
                    : empleado.marcoHoy
                      ? 'bg-[#F3F4F6] text-[#4B5563]'
                      : 'bg-[#E5E7EB] text-[#6B7280]'
                }`}>
                  {empleado.siguienteTipo === 'salida'
                    ? 'Dentro de la jornada · falta registrar salida'
                    : empleado.marcoHoy
                      ? 'Ya registró salida hoy'
                      : 'Aún no registra hoy'}
                </span>
              </div>

              {/* Ultimo registro */}
              {empleado.ultimoRegistro && (
                <div className="mt-4 p-3 bg-white rounded-lg border border-[#6B7280] flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#6B7280] uppercase mb-1">Último registro</p>
                    <span className={`font-semibold ${
                      empleado.ultimoRegistro === 'entrada' ? 'text-[#4B5563]' : 'text-[#111827]'
                    }`}>
                      {empleado.ultimoRegistro === 'entrada' ? 'ENTRADA' : 'SALIDA'}
                    </span>
                  </div>
                  <span className="text-sm text-[#6B7280] tabular-nums">
                    {empleado.timestamp
                      ? new Date(empleado.timestamp).toLocaleString('es-MX', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })
                      : ''}
                  </span>
                </div>
              )}

              {/* Boton que cambia: ENTRADA (verde) o SALIDA (rojo) */}
              {listoParaMarcar && (
                <button
                  onClick={marcar}
                  className={`mt-4 w-full py-3 rounded-lg text-white font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                    empleado.siguienteTipo === 'entrada'
                      ? 'bg-[#4B5563] hover:bg-[#111827]'
                      : 'bg-[#111827] hover:bg-[#4B5563]'
                  }`}
                >
                  {empleado.siguienteTipo === 'entrada' ? (
                    <>
                      <LogIn size={18} /> MARCAR ENTRADA
                    </>
                  ) : (
                    <>
                      <LogOut size={18} /> MARCAR SALIDA
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Historial reciente del socio (ultimos 10 registros) */}
          {empleado && historial.length > 0 && (
            <div className="mt-6 pt-6 border-t border-[#6B7280]">
              <h3 className="text-sm text-[#6B7280] uppercase tracking-widest mb-3 flex items-center gap-2">
                <History size={14} /> Últimos registros de {empleado.nombre}
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {historial.map((reg) => (
                  <div key={reg._id} className="flex items-center justify-between py-2 px-3 bg-[#F3F4F6] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        reg.tipo === 'entrada' ? 'bg-[#6B7280]' : 'bg-[#111827]'
                      }`} />
                      <span className="text-sm font-medium text-[#111827]">
                        {reg.nombre || reg.codigo}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-[#6B7280]">
                      <span className={`font-semibold ${
                        reg.tipo === 'entrada' ? 'text-[#4B5563]' : 'text-[#111827]'
                      }`}>
                        {reg.tipo === 'entrada' ? 'ENTRADA' : 'SALIDA'}
                      </span>
                      <span className="tabular-nums">
                        {new Date(reg.fecha).toLocaleString('es-MX', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {empleado && historial.length === 0 && (
            <div className="mt-6 pt-6 border-t border-[#6B7280] text-center">
              <p className="text-sm text-[#6B7280]">Sin registros previos para {empleado.codigo}</p>
            </div>
          )}

          {/* Atender a otro codigo */}
          {empleado && (
            <button
              onClick={limpiar}
              className="mt-6 w-full py-2 text-sm text-[#6B7280] hover:text-[#111827]
                         border border-[#6B7280] hover:border-[#111827] rounded-lg transition-all"
            >
              Atender otro código
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#F3F4F6] p-3 text-center text-xs text-[#6B7280]">
          GymFit — Sistema de Gestión • Módulo de Asistencia
        </div>
      </div>
    </div>
  );
};

export default Attendance;
