import { useEffect, useRef, useState } from 'react';

export async function membresiasRequest(path, options = {}) {
  const respuesta = await fetch(`/cobro/api${path}`, { ...options, headers: {
    'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}`, ...options.headers,
  } });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error || datos.message || 'No se pudo completar la operación.');
  return datos;
}
const hoy = () => {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
};
const dinero = valor => Number(valor).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const METODOS_PAGO = [
  { key: 'efectivo', label: 'Efectivo', icon: 'payments' },
  { key: 'tarjeta', label: 'Tarjeta', icon: 'credit_card' },
  { key: 'transferencia', label: 'Transferencia', icon: 'account_balance' },
];

function IconoPago({ nombre, grande = false }) {
  return <span className={`material-symbols-rounded ${grande ? 'text-2xl' : 'text-xl'}`} aria-hidden="true"
    style={{ fontVariationSettings: `"FILL" ${grande ? 1 : 0}, "wght" 500, "GRAD" 0, "opsz" 24` }}>{nombre}</span>;
}

export function puedeCobrarMembresia(metodo, efectivo, total) {
  if (metodo === 'tarjeta' || metodo === 'transferencia') return true;
  return metodo === 'efectivo' && efectivo !== '' && Number.isFinite(Number(efectivo)) && Number(efectivo) >= total;
}

export function PagoMembresia({ cliente, membresia, opcion, fechaInicio, metodoPago, setMetodoPago, efectivo, setEfectivo, referencia, setReferencia, ocupado }) {
  const total = Number(opcion.costo);
  const insuficiente = efectivo !== '' && !puedeCobrarMembresia('efectivo', efectivo, total);
  return <>
    <div className="rx-context-card">
      <div className="rx-table-product">
        <span className="rx-avatar rx-avatar--large">{cliente.nombre.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('')}</span>
        <div>
          <p className="rx-context-title">{cliente.nombre}</p>
          <p className="rx-context-copy">{membresia.nombre} · {opcion.entradas === null ? 'Entradas ilimitadas' : `${opcion.entradas} entradas`} · {opcion.duracion ?? opcion.vigenciaDias} {opcion.unidadDuracion || 'días'}</p>
          <p className="rx-context-meta">Cliente #{cliente.id} · Inicio de vigencia: {fechaInicio}</p>
        </div>
      </div>
    </div>
    {!metodoPago && <div className="rx-field">
      <span className="rx-label">Método de pago</span>
      <div className="rx-payment-methods">
        {METODOS_PAGO.map(metodo => <button key={metodo.key} type="button" disabled={ocupado} className="rx-payment-method" onClick={() => setMetodoPago(metodo.key)}>
          <IconoPago nombre={metodo.icon} grande />{metodo.label}
        </button>)}
      </div>
    </div>}
    {metodoPago && <div className="rx-form-stack">
      <button type="button" className="rx-back-button" disabled={ocupado} onClick={() => setMetodoPago('')}><IconoPago nombre="arrow_back" />Cambiar método de pago</button>
      {metodoPago === 'efectivo' && <>
        <label className="rx-field"><span className="rx-label">Efectivo recibido</span>
          <input required autoFocus disabled={ocupado} className={`rx-input rx-input--amount ${insuficiente ? 'rx-input--error' : ''}`} type="number" step="0.01" min={total} value={efectivo} onChange={e => setEfectivo(e.target.value)} placeholder={`Mínimo ${dinero(total)}`} />
          {insuficiente && <span className="rx-error-text" role="alert"><IconoPago nombre="warning" />El efectivo es insuficiente</span>}
        </label>
        {puedeCobrarMembresia('efectivo', efectivo, total) && <div className="rx-change-box" aria-live="polite"><div className="rx-change-row"><span className="rx-change-label">Cambio a devolver</span><strong className="rx-change-value">{dinero(Math.round((Number(efectivo) - total) * 100) / 100)}</strong></div></div>}
      </>}
      {metodoPago === 'tarjeta' && <div className="rx-payment-information">
        <IconoPago nombre="credit_card" grande /><p className="rx-payment-information-label">Total a cobrar</p>
        <p className="rx-payment-information-value">{dinero(total)}</p><p className="rx-payment-information-help">Presenta la tarjeta en la terminal física.</p>
      </div>}
      {metodoPago === 'transferencia' && <>
        <div className="rx-payment-information"><IconoPago nombre="account_balance" grande /><p className="rx-payment-information-label">Total a transferir</p><p className="rx-payment-information-value">{dinero(total)}</p></div>
        <label className="rx-field"><span className="rx-label">Referencia de transferencia</span><input disabled={ocupado} className="rx-input" maxLength={200} value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Ej. TRF-001" /><span className="rx-help-text">La referencia es opcional.</span></label>
      </>}
    </div>}
  </>;
}

export function filtrarClientesMembresias(clientes, busqueda) {
  const normalizar = valor => String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const texto = normalizar(busqueda).replace(/^#/, '');
  return clientes.filter(c => c.activo !== false && (normalizar(c.nombre).includes(texto) || String(c.id).includes(texto)));
}

export function SaldosMembresias({ compras, clases = [] }) {
  return <div className="rx-memberships rx-stack" aria-live="polite">
    {compras.length === 0 && <p className="rx-help-text">Sin membresías compradas. Las clases se cobran por separado.</p>}
    {compras.map(compra => <article key={compra.id} className="rx-card">
      <strong>{compra.nombre}</strong>
      <p className="rx-card-text">{compra.fechaInicio} al {compra.fechaFin} · {compra.vigente ? 'Vigente' : 'Fuera de vigencia'}</p>
      {compra.saldos.map((saldo, index) => <p className="rx-card-text" key={index}>
        {saldo.claseId ? `${clases.find(c => c.idClase === saldo.claseId)?.nombre || saldo.claseId}: ` : 'Entradas compartidas: '}
        {saldo.disponibles === null ? 'Ilimitadas' : `${saldo.disponibles} disponibles de ${saldo.total}`} · {saldo.apartadas} apartadas · {saldo.consumidas} consumidas
      </p>)}
    </article>)}
  </div>;
}

export default function MembresiasRecepcion({ clientes, clases, onTicket, onVenta, onClose }) {
  const [catalogo, setCatalogo] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [mostrarClientes, setMostrarClientes] = useState(false);
  const [indiceCliente, setIndiceCliente] = useState(-1);
  const panel = useRef(null);
  const buscador = useRef(null);
  const [membresiaId, setMembresiaId] = useState('');
  const [opcionId, setOpcionId] = useState('');
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [pasoCobro, setPasoCobro] = useState(false);
  const [metodoPago, setMetodoPago] = useState('');
  const [efectivo, setEfectivo] = useState('');
  const [referencia, setReferencia] = useState('');
  const [compras, setCompras] = useState([]);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [version, setVersion] = useState(0);
  const envio = useRef(false);
  // La clave sobrevive a un error de red: el reintento recupera la misma venta.
  const solicitud = useRef(null);
  const membresia = catalogo.find(m => m.idMembresia === membresiaId);
  const opcion = membresia?.opciones.find(o => o.id === opcionId);
  const clientesFiltrados = filtrarClientesMembresias(clientes, busqueda);
  const clienteSeleccionado = clientes.find(c => String(c.id) === clienteId);

  function seleccionarCliente(cliente) {
    setClienteId(String(cliente.id));
    setBusqueda(cliente.nombre);
    setMostrarClientes(false);
    setIndiceCliente(-1);
    setError('');
  }

  useEffect(() => {
    const anterior = document.activeElement;
    buscador.current?.focus();
    return () => { anterior?.focus(); };
  }, []);

  useEffect(() => {
    if (pasoCobro) panel.current?.querySelector('.rx-modal-close')?.focus();
    else buscador.current?.focus();
  }, [pasoCobro]);

  function volverAVenta() {
    if (envio.current) return;
    setPasoCobro(false);
    setMetodoPago('');
    setError('');
  }

  function manejarTeclado(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (mostrarClientes) setMostrarClientes(false);
      else if (pasoCobro) volverAVenta();
      else if (!envio.current) onClose();
    }
    if (event.key === 'Tab') {
      const controles = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')];
      const primero = controles[0];
      const ultimo = controles[controles.length - 1];
      if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo?.focus(); }
      else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero?.focus(); }
    }
  }

  useEffect(() => {
    let vigente = true;
    membresiasRequest('/membresias/catalogo').then(datos => { if (vigente) setCatalogo(datos); })
      .catch(e => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, []);
  useEffect(() => {
    let vigente = true;
    setCompras([]);
    if (!clienteId) { setCargando(false); return; }
    setCargando(true);
    membresiasRequest(`/clientes/${clienteId}/membresias`).then(datos => { if (vigente) setCompras(datos); })
      .catch(e => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [clienteId, version]);

  async function vender(event) {
    event.preventDefault();
    if (envio.current) return;
    if (!clienteSeleccionado || clienteSeleccionado.activo === false || !opcion || opcion.costo === null) {
      setError('Selecciona un cliente de la lista y una presentación disponible.');
      return;
    }
    if (!pasoCobro) {
      setMostrarClientes(false);
      setError('');
      setPasoCobro(true);
      return;
    }
    if (!puedeCobrarMembresia(metodoPago, efectivo, Number(opcion.costo))) {
      setError('Elige un método de pago y verifica que el efectivo cubra el total.');
      return;
    }
    envio.current = true;
    setOcupado(true); setError('');
    const datos = { clienteId: Number(clienteId), membresiaId, opcionId, fechaInicio, metodoPago,
      efectivoRecibido: metodoPago === 'efectivo' ? Number(efectivo) : null, referencia };
    const firma = JSON.stringify(datos);
    if (!solicitud.current || solicitud.current.firma !== firma) solicitud.current = { firma, id: crypto.randomUUID() };
    try {
      const resultado = await membresiasRequest('/membresias/compras', { method: 'POST', body: JSON.stringify({ ...datos, solicitudId: solicitud.current.id }) });
      solicitud.current = null;
      setVersion(v => v + 1);
      setEfectivo('');
      onTicket(resultado.ticket);
      onVenta();
    } catch (e) { setError(e.message); }
    finally { envio.current = false; setOcupado(false); }
  }
  async function abrirTicket(id) {
    if (envio.current) return;
    envio.current = true; setOcupado(true); setError('');
    try { onTicket(await membresiasRequest(`/membresias/compras/${id}/ticket`)); }
    catch (e) { setError(e.message); }
    finally { envio.current = false; setOcupado(false); }
  }
  return <div className="rx-modal-overlay" role="presentation">
    <section ref={panel} className="rx-modal rx-modal--scroll modal-enter" role="dialog" aria-modal="true" aria-labelledby="venta-membresia" onKeyDown={manejarTeclado}>
    <header className="rx-modal-header">
      <div>
        <h2 id="venta-membresia" className="rx-modal-title">{pasoCobro ? 'Cobro' : 'Vender membresía'}</h2>
        <p className="rx-modal-subtitle rx-modal-subtitle--plain">{pasoCobro ? (metodoPago ? `Pago con ${METODOS_PAGO.find(m => m.key === metodoPago).label.toLowerCase()}` : 'Elige el método de pago') : 'Selecciona un cliente y genera su compra con ticket.'}</p>
      </div>
      <button type="button" disabled={ocupado} onClick={pasoCobro ? volverAVenta : onClose} aria-label={pasoCobro ? 'Cerrar ventana de cobro' : 'Cerrar'} className="rx-modal-close"><IconoPago nombre="close" /></button>
    </header>
    {pasoCobro && <div className="rx-payment-total-banner"><p className="rx-payment-total-label">Total a cobrar</p><p className="rx-payment-total-value">{dinero(opcion.costo)}</p></div>}
    <form id="form-venta-membresia" onSubmit={vender} className="rx-modal-body rx-form-stack">
      {error && <p className="rx-error-text" role="alert">{error}</p>}
      {pasoCobro ? <PagoMembresia cliente={clienteSeleccionado} membresia={membresia} opcion={opcion} fechaInicio={fechaInicio}
        metodoPago={metodoPago} setMetodoPago={setMetodoPago} efectivo={efectivo} setEfectivo={setEfectivo} referencia={referencia} setReferencia={setReferencia} ocupado={ocupado} /> : <>
      <fieldset disabled={ocupado} className="rx-form-stack rx-membership-fields">
        <div className="rx-field">
          <label className="rx-label" htmlFor="buscar-cliente-membresia">Buscar cliente</label>
          <div className="rx-autocomplete">
            <input ref={buscador} id="buscar-cliente-membresia" className="rx-input" type="text" autoComplete="off" placeholder="Escribe ID o nombre..."
              role="combobox" aria-autocomplete="list" aria-expanded={mostrarClientes} aria-controls="clientes-membresia-lista"
              aria-activedescendant={mostrarClientes && indiceCliente >= 0 ? `cliente-membresia-${clientesFiltrados[indiceCliente]?.id}` : undefined}
              value={busqueda} onChange={e => { setBusqueda(e.target.value); setClienteId(''); setCompras([]); setMostrarClientes(true); setIndiceCliente(-1); setError(''); }}
              onFocus={() => { if (!clienteId) setMostrarClientes(true); }}
              onBlur={() => setMostrarClientes(false)}
              onKeyDown={e => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault(); setMostrarClientes(true);
                  setIndiceCliente(i => clientesFiltrados.length ? (i + (e.key === 'ArrowDown' ? 1 : -1) + clientesFiltrados.length) % clientesFiltrados.length : -1);
                }
                if (e.key === 'Enter' && mostrarClientes) { e.preventDefault(); if (clientesFiltrados[indiceCliente]) seleccionarCliente(clientesFiltrados[indiceCliente]); }
              }} />
            {mostrarClientes && <ul id="clientes-membresia-lista" className="rx-suggestions" role="listbox" aria-label="Clientes registrados">
              {clientesFiltrados.map((cliente, indice) => <li key={cliente.id} id={`cliente-membresia-${cliente.id}`} role="option" aria-selected={indice === indiceCliente}
                className="rx-suggestion" onMouseDown={e => e.preventDefault()} onClick={() => seleccionarCliente(cliente)}>
                <span>{cliente.nombre} <span className="rx-cell-subtle">#{cliente.id}</span></span>
                <span className={`rx-badge ${cliente.tieneCompras ? 'rx-badge--accent' : 'rx-badge--neutral'}`}>
                  {cliente.membresiasCompradas?.map(c => c.nombre).join(' · ') || (cliente.tieneCompras ? 'Con membresías compradas' : 'Sin membresías compradas')}
                </span>
              </li>)}
              {clientesFiltrados.length === 0 && <li className="rx-suggestion rx-suggestion--empty">No se encontraron clientes activos</li>}
            </ul>}
          </div>
          {clienteSeleccionado && <span className="rx-help-text">Cliente seleccionado: #{clienteSeleccionado.id} · {clienteSeleccionado.nombre}</span>}
          <span className="rx-help-text">Puedes vender a clientes con o sin membresías compradas.</span>
        </div>
        <label className="rx-field"><span className="rx-label">Membresía del catálogo</span>
          <select required className="rx-input" value={membresiaId} onChange={e => { setMembresiaId(e.target.value); setOpcionId(''); }}>
            <option value="">Selecciona una membresía</option>
            {catalogo.map(m => <option key={m.idMembresia} value={m.idMembresia}>{m.nombre}</option>)}
          </select>
        </label>
        {catalogo.length === 0 && <p className="rx-help-text">Crea o activa una membresía vinculada a clases en Administración.</p>}
        <label className="rx-field"><span className="rx-label">Presentación</span>
          <select required className="rx-input" value={opcionId} onChange={e => setOpcionId(e.target.value)}>
            <option value="">Selecciona entradas y vigencia</option>
            {membresia?.opciones.map(o => <option disabled={o.costo === null} key={o.id} value={o.id}>
              {o.entradas === null ? 'Ilimitadas' : `${o.entradas} entradas`} · {o.duracion ?? o.vigenciaDias} {o.unidadDuracion || 'días'} · {o.costo === null ? 'Precio por definir' : dinero(o.costo)}
            </option>)}
          </select>
        </label>
        {opcion && <div className="rx-context-card"><p className="rx-help-text">{opcion.distribucion === 'por_clase' ? 'Entradas por clase' : 'Entradas compartidas'} · Clases: {clases.filter(c => membresia.clasesIds.includes(c.idClase)).map(c => c.nombre).join(', ')}</p></div>}
        <label className="rx-field"><span className="rx-label">Inicio de vigencia</span><input required className="rx-input" type="date" min={hoy()} value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} /></label>
        <div className="rx-context-card rx-summary-row"><span>Total</span><strong className="rx-summary-total-value">{dinero(opcion?.costo ?? 0)}</strong></div>
      </fieldset>
    {clienteId && <div className="rx-stack">
      <h3 className="rx-card-title">Compras y saldo del cliente</h3>
      {cargando ? <p role="status">Consultando saldo…</p> : <SaldosMembresias compras={compras} clases={clases} />}
      {compras.map(c => <button key={c.id} type="button" className="rx-btn rx-btn--outline" disabled={ocupado || cargando} onClick={() => abrirTicket(c.id)}>Ver ticket {c.folio}</button>)}
    </div>}
    </>}
    </form>
    <footer className="rx-modal-footer">
      <button type="button" className="rx-btn rx-btn--outline" disabled={ocupado} onClick={pasoCobro ? volverAVenta : onClose}>Cancelar</button>
      <button className="rx-btn rx-btn--dark" type="submit" form="form-venta-membresia" disabled={ocupado || !clienteId || !opcion || opcion.costo === null || (pasoCobro && !puedeCobrarMembresia(metodoPago, efectivo, Number(opcion.costo)))}>
        <IconoPago nombre={pasoCobro ? 'check_circle' : 'payments'} />{ocupado ? 'Registrando…' : pasoCobro ? 'Confirmar cobro' : 'Continuar al cobro'}
      </button>
    </footer>
    </section>
  </div>;
}