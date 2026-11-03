import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle,
  User,
  AlertTriangle,
  LogIn,
  LogOut,
  History,
} from 'lucide-react';

// Formatos aceptados: EMP-101, CLI-3 o el ID numérico de un socio.
const listoBuscar = (codigo) =>
  /^\d+$/.test(codigo) ||
  /^CLI-\d+$/.test(codigo) ||
  /^EMP-\d{3}$/.test(codigo);

// Normaliza el ID numérico de un socio: "3" -> "CLI-3".
const normalizar = (codigo) =>
  /^\d+$/.test(codigo) ? `CLI-${codigo}` : codigo;

// Traducción y estilo para el estado que devuelve el backend.
const ETIQUETAS_ESTADO = {
  puntual: {
    texto: 'Puntual',
    clases: 'bg-emerald-100 text-emerald-700',
  },
  retardo: {
    texto: 'Retardo',
    clases: 'bg-amber-100 text-amber-700',
  },
  inasistencia: {
    texto: 'Inasistencia',
    clases: 'bg-red-100 text-red-700',
  },
  sin_turno: {
    texto: 'Sin turno asignado',
    clases: 'bg-slate-100 text-slate-600',
  },
};

const obtenerRegistros = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.registros)) return data.registros;
  return [];
};

const formatearFecha = (valor) => {
  if (!valor) return '';

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';

  return fecha.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatearHora = (valor) => {
  if (!valor) return '';

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);

  return fecha.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const Attendance = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [empleado, setEmpleado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [marcando, setMarcando] = useState(false);

  // Permite ignorar las respuestas de búsquedas anteriores.
  const busqRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Búsqueda automática después de dejar de escribir.
  useEffect(() => {
    const cod = codigo.trim().toUpperCase();

    if (!cod) {
      busqRef.current += 1;
      setEmpleado(null);
      setHistorial([]);
      setResultado(null);
      setCargando(false);
      return;
    }

    const id = ++busqRef.current;
    const timer = setTimeout(() => buscar(cod, id), 400);

    return () => clearTimeout(timer);
    // buscar usa busqRef para descartar respuestas obsoletas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);

  const buscar = async (cod, id) => {
    if (id !== busqRef.current) return;

    if (!listoBuscar(cod)) {
      setEmpleado(null);
      setHistorial([]);

      if (cod.length >= 3) {
        setResultado({
          exitoso: false,
          msg: 'Código no encontrado',
        });
      }

      return;
    }

    setCargando(true);

    try {
      const resPersona = await fetch(
        `/cobro/api/asistencia/empleado/${encodeURIComponent(cod)}`
      );

      if (id !== busqRef.current) return;

      if (resPersona.status === 404) {
        const data = await resPersona.json();

        setEmpleado(null);
        setHistorial([]);
        setResultado({
          exitoso: false,
          msg: data.error || 'Código no encontrado',
        });

        return;
      }

      if (!resPersona.ok) {
        throw new Error('No se pudo consultar a la persona');
      }

      const persona = await resPersona.json();

      if (id !== busqRef.current) return;

      const resHistorial = await fetch(
        `/cobro/api/asistencia/historial/${encodeURIComponent(persona.codigo || cod)}`
      );

      if (id !== busqRef.current) return;

      const historialData = resHistorial.ok
        ? await resHistorial.json()
        : [];

      setEmpleado(persona);
      setHistorial(obtenerRegistros(historialData));
      setResultado(null);
    } catch (error) {
      console.error('Error buscando persona:', error);

      if (id === busqRef.current) {
        setResultado({
          exitoso: false,
          msg: 'No se pudo conectar con el servidor.',
        });
      }
    } finally {
      if (id === busqRef.current) {
        setCargando(false);
      }
    }
  };

  const marcar = async () => {
    if (!empleado || marcando) return;

    const codigoMarcado = empleado.codigo;
    setMarcando(true);
    setResultado(null);

    try {
      const res = await fetch('/cobro/api/asistencia/marcar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigoMarcado }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResultado({
          exitoso: false,
          tipo: null,
          estado: null,
          msg: data.error || 'Error al registrar la asistencia.',
        });
        return;
      }

      // Actualiza la persona y el historial después de registrar la marcación.
      const [resEmpleado, resHistorial] = await Promise.all([
        fetch(
          `/cobro/api/asistencia/empleado/${encodeURIComponent(codigoMarcado)}`
        ),
        fetch(
          `/cobro/api/asistencia/historial/${encodeURIComponent(codigoMarcado)}`
        ),
      ]);

      if (resEmpleado.ok) {
        const personaActualizada = await resEmpleado.json();

        // Evita cambiar la tarjeta si ya se está consultando otro código.
        if (normalizar(codigo.trim().toUpperCase()) === codigoMarcado) {
          setEmpleado(personaActualizada);
        }
      }

      if (resHistorial.ok) {
        const historialData = await resHistorial.json();
        setHistorial(obtenerRegistros(historialData));
      }

      const etiquetaEstado = ETIQUETAS_ESTADO[data.estado]?.texto;

      setResultado({
        exitoso: true,
        tipo: data.tipo,
        estado: data.estado || null,
        msg:
          `${data.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Salida'} registrada correctamente` +
          (etiquetaEstado ? ` · ${etiquetaEstado}` : ''),
      });
    } catch (error) {
      console.error('Error al marcar asistencia:', error);

      setResultado({
        exitoso: false,
        tipo: null,
        estado: null,
        msg: 'No se pudo conectar con el servidor.',
      });
    } finally {
      setMarcando(false);
    }
  };

  const limpiar = () => {
    busqRef.current += 1;
    setEmpleado(null);
    setHistorial([]);
    setCodigo('');
    setResultado(null);
    setCargando(false);
    setMarcando(false);
  };

  const codActual = codigo.trim().toUpperCase();

  const listoParaMarcar = Boolean(
    empleado &&
      codActual &&
      normalizar(codActual) === empleado.codigo
  );

  const horaFormateada = currentTime.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const fechaFormateada = currentTime.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="bg-emerald-500 p-5 text-white flex items-center justify-between gap-4">
          <div className="text-left">
            <h1 className="text-2xl font-bold">
              NUUCLE - Checador de Asistencia
            </h1>
            <p className="opacity-90 text-sm">Registro de Asistencia</p>
          </div>

          <div className="text-right shrink-0">
            <div className="text-2xl font-bold tabular-nums">
              {horaFormateada}
            </div>
            <div className="text-xs opacity-90 capitalize">
              {fechaFormateada}
            </div>
          </div>
        </div>

        <div className="p-8">
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
                  setResultado(null);
                }}
                placeholder="Escanea o captura tu código (EMP-101 o ID del socio)"
                className="w-full pl-12 pr-4 py-4 text-xl border-2 border-slate-200 rounded-xl
                           focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20
                           transition-all text-center tracking-[0.3em] uppercase placeholder:tracking-normal"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && codigo.trim()) {
                    buscar(
                      codigo.trim().toUpperCase(),
                      ++busqRef.current
                    );
                  }
                }}
                autoFocus
              />
            </div>

            {cargando && !listoParaMarcar && (
              <div className="py-3 text-center text-sm text-slate-400 animate-pulse">
                Buscando código...
              </div>
            )}
          </div>

          {resultado && (
            <div
              className={`mt-6 p-4 rounded-xl flex items-start gap-3 ${
                resultado.exitoso
                  ? 'bg-emerald-50 border border-emerald-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              {resultado.exitoso ? (
                <CheckCircle
                  className="text-emerald-500 shrink-0 mt-0.5"
                  size={24}
                />
              ) : (
                <AlertTriangle
                  className="text-red-500 shrink-0 mt-0.5"
                  size={24}
                />
              )}

              <div>
                <p
                  className={`font-semibold ${
                    resultado.exitoso
                      ? 'text-emerald-800'
                      : 'text-red-800'
                  }`}
                >
                  {resultado.msg}
                </p>

                {resultado.tipo && (
                  <p
                    className={`text-sm mt-1 ${
                      resultado.tipo === 'entrada'
                        ? 'text-emerald-700'
                        : 'text-red-700'
                    }`}
                  >
                    {resultado.tipo === 'entrada'
                      ? '🟢 Entrada'
                      : '🔴 Salida'}
                  </p>
                )}

                {resultado.estado &&
                  ETIQUETAS_ESTADO[resultado.estado] && (
                    <span
                      className={`inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full ${
                        ETIQUETAS_ESTADO[resultado.estado].clases
                      }`}
                    >
                      {ETIQUETAS_ESTADO[resultado.estado].texto}
                    </span>
                  )}
              </div>
            </div>
          )}

          {empleado && (
            <div className="mt-6 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-semibold">
                    Usuario encontrado
                  </p>

                  <p className="text-2xl font-bold text-slate-800">
                    {empleado.nombre}
                  </p>

                  <p className="text-sm text-slate-600 mt-1">
                    {empleado.tipo === 'cliente'
                      ? `Membresía: ${empleado.membresia}`
                      : `${empleado.rol || 'Empleado'} · ${empleado.codigo}`}
                  </p>

                  {empleado.horaInicio && (
                    <p className="text-xs text-slate-500 mt-1">
                      Inicio de turno: {formatearHora(empleado.horaInicio)}
                    </p>
                  )}
                </div>

                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    empleado.siguienteTipo === 'salida'
                      ? 'bg-amber-100 text-amber-700'
                      : empleado.marcoHoy
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {empleado.siguienteTipo === 'salida'
                    ? 'Dentro de la jornada · falta registrar salida'
                    : empleado.marcoHoy
                      ? 'Ya registró salida hoy'
                      : 'Aún no registra hoy'}
                </span>
              </div>

              {empleado.ultimoRegistro && (
                <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase mb-1">
                      Último registro
                    </p>

                    <span
                      className={`font-semibold ${
                        empleado.ultimoRegistro === 'entrada'
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    >
                      {empleado.ultimoRegistro === 'entrada'
                        ? '🟢 ENTRADA'
                        : '🔴 SALIDA'}
                    </span>
                  </div>

                  <span className="text-sm text-slate-600 tabular-nums">
                    {formatearFecha(empleado.timestamp)}
                  </span>
                </div>
              )}

              {listoParaMarcar && (
                <button
                  onClick={marcar}
                  disabled={marcando}
                  className={`mt-4 w-full py-3 rounded-lg text-white font-semibold transition-all
                    active:scale-[0.98] flex items-center justify-center gap-2
                    disabled:opacity-60 disabled:cursor-not-allowed ${
                      empleado.siguienteTipo === 'entrada'
                        ? 'bg-emerald-500 hover:bg-emerald-600'
                        : 'bg-red-500 hover:bg-red-600'
                    }`}
                >
                  {empleado.siguienteTipo === 'entrada' ? (
                    <>
                      <LogIn size={18} />
                      {marcando ? 'REGISTRANDO...' : 'MARCAR ENTRADA'}
                    </>
                  ) : (
                    <>
                      <LogOut size={18} />
                      {marcando ? 'REGISTRANDO...' : 'MARCAR SALIDA'}
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {empleado && historial.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h3 className="text-sm text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <History size={14} />
                Últimos registros de {empleado.nombre}
              </h3>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {historial.map((reg) => (
                  <div
                    key={reg._id || `${reg.codigo}-${reg.ts || reg.fecha}`}
                    className="flex items-center justify-between gap-3 py-2 px-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          reg.tipo === 'entrada'
                            ? 'bg-emerald-500'
                            : 'bg-red-500'
                        }`}
                      />

                      <div>
                        <span className="text-sm font-medium text-slate-700">
                          {reg.nombre || reg.codigo}
                        </span>

                        {reg.estado && ETIQUETAS_ESTADO[reg.estado] && (
                          <span
                            className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                              ETIQUETAS_ESTADO[reg.estado].clases
                            }`}
                          >
                            {ETIQUETAS_ESTADO[reg.estado].texto}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span
                        className={`font-semibold ${
                          reg.tipo === 'entrada'
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {reg.tipo === 'entrada' ? 'ENTRADA' : 'SALIDA'}
                      </span>

                      <span className="tabular-nums">
                        {formatearFecha(reg.fecha || reg.ts)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {empleado && historial.length === 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                Sin registros previos para {empleado.codigo}
              </p>
            </div>
          )}

          {empleado && (
            <button
              onClick={limpiar}
              className="mt-6 w-full py-2 text-sm text-slate-500 hover:text-slate-700
                         border border-slate-200 hover:border-slate-300 rounded-lg transition-all"
            >
              Atender otro código
            </button>
          )}
        </div>

        <div className="bg-slate-50 p-3 text-center text-xs text-slate-400">
          NUUCLEO — Sistema de Gestión • Módulo de Asistencia
        </div>
      </div>
    </div>
  );
};

export default Attendance;