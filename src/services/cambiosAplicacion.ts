// Avisa únicamente después de escrituras HTTP exitosas, sin modificar sus respuestas.
export const EVENTO_CAMBIO_APLICACION = 'rx:datos-actualizados';
export const CLAVE_CAMBIO_APLICACION = 'rx:ultimo-cambio';

export function instalarAvisosDeCambios() {
  const fetchOriginal = window.fetch;
  const avisar = () => {
    window.dispatchEvent(new Event(EVENTO_CAMBIO_APLICACION));
    try {
      // El evento storage avisa a las otras pestañas del mismo origen.
      localStorage.setItem(CLAVE_CAMBIO_APLICACION, `${Date.now()}-${Math.random()}`);
    } catch {
      // El aviso local sigue funcionando si el navegador bloquea el almacenamiento.
    }
  };
  const fetchConAviso: typeof fetch = async (input, opciones) => {
    const respuesta = await fetchOriginal.call(window, input, opciones);
    const peticion = typeof Request !== 'undefined' && input instanceof Request ? input : null;
    const metodo = (opciones?.method || peticion?.method || 'GET').toUpperCase();
    const url = new URL(peticion ? peticion.url : String(input), window.location.href);
    const esApi = /^\/(?:admin\/api|cobro\/api|api)(?:\/|$)/.test(url.pathname);
    if (respuesta.ok && url.origin === window.location.origin && esApi && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(metodo)
      && !/\/auth(?:\/|$)/.test(url.pathname)) avisar();
    return respuesta;
  };
  window.fetch = fetchConAviso;
  return () => {
    if (window.fetch === fetchConAviso) window.fetch = fetchOriginal;
  };
}