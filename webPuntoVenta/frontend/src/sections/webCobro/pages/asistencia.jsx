import BrandLogo from '../../../components/BrandLogo';
import { useState, useEffect, useRef } from 'react';
import MaterialIcon from '../../../components/MaterialIcon';

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
    clases: 'rx-badge--success',
  },
  retardo: {
    texto: 'Retardo',
    clases: 'rx-badge--warning',
  },
  inasistencia: {
    texto: 'Inasistencia',
    clases: 'rx-badge--danger',
  },
  sin_turno: {
    texto: 'Sin turno asignado',
    clases: 'rx-badge--neutral',
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

// Iniciales para el avatar: "Ana García" -> "AG".
const iniciales = (nombre = '') =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0] || '')
    .join('')
    .toUpperCase() || '?';

// Ícono de una marca: la entrada resalta en verde y la salida queda neutra. Las
// inasistencias que registra el sistema llevan otro ícono porque nadie marcó.
const IconoMarca = ({ tipo, automatica = false }) => {
  const esEntrada = tipo === 'entrada' && !automatica;
  const icono = automatica ? 'person_off' : esEntrada ? 'login' : 'logout';

  return (
    <span
      className={`rx-admin-list-icon ${esEntrada ? 'rx-kiosk-entry-icon' : ''}`}
    >
      <MaterialIcon name={icono} className="text-xl" />
    </span>
  );
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

      if (id !== busqRef.current) return;
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
    if (!empleado || marcando || normalizar(codigo.trim().toUpperCase()) !== empleado.codigo) return;

    const codigoMarcado = empleado.codigo;
    const busquedaMarcada = busqRef.current;
    setMarcando(true);
    setResultado(null);

    try {
      const res = await fetch('/cobro/api/asistencia/marcar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigoMarcado }),
      });

      const data = await res.json();

      if (busquedaMarcada !== busqRef.current) return;
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

      if (busquedaMarcada !== busqRef.current) return;
      if (resEmpleado.ok) {
        const personaActualizada = await resEmpleado.json();
        if (busquedaMarcada !== busqRef.current) return;

        // Evita cambiar la tarjeta si ya se está consultando otro código.
        if (normalizar(codigo.trim().toUpperCase()) === codigoMarcado) {
          setEmpleado(personaActualizada);
        }
      }

      if (resHistorial.ok) {
        const historialData = await resHistorial.json();
        if (busquedaMarcada !== busqRef.current) return;
        setHistorial(obtenerRegistros(historialData));
      }

      const etiquetaEstado = ETIQUETAS_ESTADO[data.estado]?.texto;

      setResultado({
        exitoso: true,
        tipo: data.tipo,
        estado: data.estado || null,
        msg:
          `${data.tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada correctamente` +
          (etiquetaEstado ? ` · ${etiquetaEstado}` : ''),
      });
    } catch (error) {
      console.error('Error al marcar asistencia:', error);

      if (busquedaMarcada !== busqRef.current) return;
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
    <div className="rx-kiosk">
      <main className="rx-kiosk-card">
        <header className="rx-kiosk-header">
          <div className="rx-kiosk-brand">
            <BrandLogo variant="symbol" className="rx-brand-symbol" />
            <div className="rx-brand-content">
              <h1 className="rx-brand-title">Nuucleo</h1>
              <p className="rx-brand-subtitle">Checador de asistencia</p>
            </div>
          </div>

          <div className="rx-kiosk-clock">
            <p className="rx-kiosk-time">{horaFormateada}</p>
            <p className="rx-kiosk-date">{fechaFormateada}</p>
          </div>
        </header>

        <div className="rx-kiosk-body">
          <div className="rx-search">
            <MaterialIcon name="person" className="rx-search-icon text-2xl" />
            <input
              type="text"
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value);
                setResultado(null);
              }}
              placeholder="Escanea o captura tu código (EMP-101 o ID del socio)"
              aria-label="Código de empleado o ID del socio"
              autoComplete="off"
              className="rx-input rx-input--kiosk"
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
            <p className="rx-kiosk-loading animate-pulse" role="status">
              Buscando código...
            </p>
          )}

          {resultado && (
            <div
              className={`rx-alert ${
                resultado.exitoso ? 'rx-alert--success' : 'rx-alert--danger'
              }`}
              role={resultado.exitoso ? 'status' : 'alert'}
            >
              <MaterialIcon
                name={resultado.exitoso ? 'check_circle' : 'warning'}
                className="flex-shrink-0 text-2xl"
                filled
              />

              <div>
                <p className="rx-alert-title">{resultado.msg}</p>

                {resultado.estado &&
                  ETIQUETAS_ESTADO[resultado.estado] && (
                    <span
                      className={`rx-badge ${
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
            <section className="rx-admin-card" aria-label="Usuario encontrado">
              <div className="rx-admin-card-header rx-kiosk-person-header">
                <div className="rx-table-product">
                  <span className="rx-kiosk-avatar">
                    {iniciales(empleado.nombre)}
                  </span>

                  <div>
                    <span className="rx-label">Usuario encontrado</span>

                    <p className="rx-kiosk-person-name">{empleado.nombre}</p>

                    <p className="rx-page-subtitle">
                      {empleado.tipo === 'cliente'
                        ? `Membresía: ${empleado.membresia}`
                        : `${empleado.rol || 'Empleado'} · ${empleado.codigo}`}
                    </p>

                    {empleado.horaInicio && (
                      <p className="rx-page-subtitle">
                        Inicio de turno: {formatearHora(empleado.horaInicio)}
                      </p>
                    )}
                  </div>
                </div>

                <span
                  className={`rx-badge ${
                    empleado.siguienteTipo === 'salida'
                      ? 'rx-badge--warning'
                      : empleado.marcoHoy
                        ? 'rx-badge--success'
                        : 'rx-badge--neutral'
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
                <div className="rx-admin-list-item">
                  <IconoMarca tipo={empleado.ultimoRegistro} />

                  <span className="rx-admin-list-copy">
                    <span>Último registro</span>
                    <strong>
                      {empleado.ultimoRegistro === 'entrada'
                        ? 'Entrada'
                        : 'Salida'}
                    </strong>
                  </span>

                  <span className="rx-kiosk-timestamp">
                    {formatearFecha(empleado.timestamp)}
                  </span>
                </div>
              )}

              {listoParaMarcar && (
                <button
                  type="button"
                  onClick={marcar}
                  disabled={marcando}
                  className={`rx-btn rx-btn--large rx-btn--block rx-kiosk-mark ${
                    empleado.siguienteTipo === 'entrada'
                      ? 'rx-btn--accent'
                      : 'rx-btn--dark'
                  }`}
                >
                  {empleado.siguienteTipo === 'entrada' ? (
                    <>
                      <MaterialIcon name="login" className="text-xl" />
                      {marcando ? 'Registrando...' : 'Marcar entrada'}
                    </>
                  ) : (
                    <>
                      <MaterialIcon name="logout" className="text-xl" />
                      {marcando ? 'Registrando...' : 'Marcar salida'}
                    </>
                  )}
                </button>
              )}
            </section>
          )}

          {empleado && (
            <section className="rx-admin-card">
              <div className="rx-admin-card-header">
                <h2 className="rx-admin-card-title">
                  Últimos registros de {empleado.nombre}
                </h2>

                {historial.length > 0 && (
                  <span className="rx-admin-count">{historial.length}</span>
                )}
              </div>

              {historial.length > 0 ? (
                <div className="rx-admin-list rx-kiosk-history">
                  {historial.map((reg) => (
                    <div
                      key={reg._id || `${reg.codigo}-${reg.ts || reg.fecha}`}
                      className="rx-admin-list-item"
                    >
                      <IconoMarca tipo={reg.tipo} automatica={reg.automatica} />

                      <span className="rx-admin-list-copy">
                        <strong>
                          {reg.automatica
                            ? 'Sin entrada registrada'
                            : reg.tipo === 'entrada'
                              ? 'Entrada'
                              : 'Salida'}
                        </strong>
                        <span>{formatearFecha(reg.fecha || reg.ts)}</span>
                      </span>

                      {reg.estado && ETIQUETAS_ESTADO[reg.estado] && (
                        <span
                          className={`rx-badge ${
                            ETIQUETAS_ESTADO[reg.estado].clases
                          }`}
                        >
                          {ETIQUETAS_ESTADO[reg.estado].texto}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rx-admin-empty">
                  <MaterialIcon name="inbox" className="text-2xl" />
                  <p>Sin registros previos para {empleado.codigo}</p>
                </div>
              )}
            </section>
          )}

          {empleado && (
            <button
              type="button"
              onClick={limpiar}
              className="rx-btn rx-btn--outline rx-btn--block"
            >
              Atender otro código
            </button>
          )}
        </div>

        <footer className="rx-kiosk-footer">
          NUUCLEO — Sistema de Gestión • Módulo de Asistencia
        </footer>
      </main>
    </div>
  );
};

export default Attendance;
