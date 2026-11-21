import { useRef, useState } from 'react';
import { membresiasRequest, PagoMembresia, puedeCobrarMembresia } from './MembresiasRecepcion';

const hoy = () => {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
};
const dinero = valor => Number(valor).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

/*
 * Cobro de una membresía que el cliente apartó desde la app móvil (código PQ-XXXXX).
 * Se paga al llegar al local: aquí se elige el método de pago y, al confirmar, la membresía queda activa.
 * Es la misma compra que ve la app y la web administrativa.
 */
export default function CobroApartada({ compra, onTicket, onCobrada, onClose }) {
  const [metodoPago, setMetodoPago] = useState('');
  const [efectivo, setEfectivo] = useState('');
  const [referencia, setReferencia] = useState('');
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const envio = useRef(false);

  const opcion = compra.condiciones.opcion;
  const total = Number(compra.precio);

  async function cobrar(evento) {
    evento.preventDefault();
    if (envio.current) return;
    if (!puedeCobrarMembresia(metodoPago, efectivo, total)) {
      setError(metodoPago ? 'El efectivo recibido no cubre el total.' : 'Elige el método de pago.');
      return;
    }
    envio.current = true; setOcupado(true); setError('');
    try {
      const resultado = await membresiasRequest(`/membresias/apartadas/${compra.idCompra}/cobrar`, {
        method: 'POST',
        body: JSON.stringify({
          metodoPago,
          efectivoRecibido: metodoPago === 'efectivo' ? Number(efectivo) : undefined,
          referencia: metodoPago === 'transferencia' ? referencia : undefined,
          fechaInicio,
        }),
      });
      onTicket(resultado.ticket);
      onCobrada();
    } catch (e) { setError(e.message); }
    finally { envio.current = false; setOcupado(false); }
  }

  return <div className="rx-modal-overlay" role="presentation">
    <section className="rx-modal rx-modal--scroll modal-enter" role="dialog" aria-modal="true" aria-labelledby="cobro-apartada">
      <header className="rx-modal-header">
        <div>
          <h2 id="cobro-apartada" className="rx-modal-title">Cobrar membresía {compra.codigo}</h2>
          <p className="rx-modal-subtitle rx-modal-subtitle--plain">La apartó {compra.nombreCliente} desde la app móvil.</p>
        </div>
        <button type="button" disabled={ocupado} onClick={onClose} aria-label="Cerrar" className="rx-modal-close">
          <span className="material-symbols-rounded text-xl" aria-hidden="true">close</span>
        </button>
      </header>
      <div className="rx-payment-total-banner">
        <p className="rx-payment-total-label">Total a cobrar</p>
        <p className="rx-payment-total-value">{dinero(total)}</p>
      </div>
      <form id="form-cobro-apartada" onSubmit={cobrar} className="rx-modal-body rx-form-stack">
        {error && <p className="rx-error-text" role="alert">{error}</p>}
        <div className="rx-field">
          <label className="rx-label" htmlFor="inicio-apartada">Inicio de vigencia</label>
          <input id="inicio-apartada" className="rx-input" type="date" min={hoy()} value={fechaInicio} disabled={ocupado}
            onChange={e => setFechaInicio(e.target.value)} required />
        </div>
        <PagoMembresia
          cliente={{ nombre: compra.nombreCliente }}
          membresia={{ nombre: compra.condiciones.nombre }}
          opcion={{ ...opcion, costo: total }}
          fechaInicio={fechaInicio}
          metodoPago={metodoPago} setMetodoPago={setMetodoPago}
          efectivo={efectivo} setEfectivo={setEfectivo}
          referencia={referencia} setReferencia={setReferencia}
          ocupado={ocupado}
        />
      </form>
      <footer className="rx-modal-footer">
        <button type="button" className="rx-btn rx-btn--outline" disabled={ocupado} onClick={onClose}>Cancelar</button>
        <button className="rx-btn rx-btn--dark" type="submit" form="form-cobro-apartada"
          disabled={ocupado || !puedeCobrarMembresia(metodoPago, efectivo, total)}>
          {ocupado ? 'Registrando…' : 'Confirmar cobro'}
        </button>
      </footer>
    </section>
  </div>;
}
