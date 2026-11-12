import MaterialIcon from '../../../components/MaterialIcon';

const dinero = valor => Number(valor ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

export default function RecepcionDetalle({ reserva, cliente, horario, compra, claseId, cargando, error, onCobrar, onAsistencia, onReagendar, onCancelar, hoy }) {
  if (!reserva) return (
    <aside className="rx-reception-detail rx-reception-detail--empty" aria-label="Detalle de reservación">
      <MaterialIcon name="person_search" className="text-3xl" />
      <h2>Selecciona una reservación</h2>
      <p>O busca un código para recibir al cliente.</p>
    </aside>
  );

  const espera = reserva.capacityStatus === 'espera';
  const pagada = reserva.paymentStatus === 'pagado';
  const vigente = reserva.status === 'pendiente' || reserva.status === 'pagado';
  const cobrable = !pagada && ['pendiente', 'asistido'].includes(reserva.status) && !espera;
  const confirmar = pagada && vigente && reserva.fecha === hoy && !espera;
  const iniciales = (reserva.client || '').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('');
  const lesiones = cliente?.perfilSalud?.lesiones;
  const paquete = reserva.membresiaCompraId ? `Compra #${reserva.membresiaCompraId}` : null;
  const saldo = compra?.saldos?.find(s => !s.claseId || String(s.claseId) === String(claseId));
  const ilimitado = saldo?.disponibles === null;
  const porcentaje = saldo && Number(saldo.total) > 0 ? Math.max(0, Math.min(100, (Number(saldo.total) - Number(saldo.disponibles)) / Number(saldo.total) * 100)) : 0;
  const finalizada = ['cancelado', 'no_asistio'].includes(reserva.status);

  return (
    <aside className="rx-reception-detail" aria-label={`Detalle de ${reserva.client}`} aria-live="polite">
      <header className="rx-reception-profile">
        <span className="rx-reception-profile-avatar">{iniciales}</span>
        <div><h2>{reserva.client}</h2><p>{reserva.type === 'visitante' ? 'Visitante' : 'Socio'} · <span className="rx-code">{reserva.codigo || `#${reserva.id}`}</span></p></div>
      </header>
      <section className="rx-reception-detail-card" aria-label="Datos de la clase">
        <dl>
          <div><dt>Clase</dt><dd>{reserva.class}</dd></div>
          <div><dt>Horario</dt><dd>{reserva.fecha || 'Sin fecha'} · {reserva.time}</dd></div>
          <div><dt>Entrenador</dt><dd>{horario?.nombreEntrenador || 'Sin dato'}</dd></div>
          <div><dt>Cupo</dt><dd>{espera ? 'Lista de espera' : 'Confirmado'}</dd></div>
          <div><dt>Asistencia</dt><dd>{reserva.status === 'asistido' ? 'Confirmada' : reserva.status === 'no_asistio' ? 'No asistió' : reserva.status === 'cancelado' ? 'Cancelada' : 'Por confirmar'}</dd></div>
          {cliente?.telefono && <div><dt>Teléfono</dt><dd>{cliente.telefono}</dd></div>}
          <div><dt>Lesiones</dt><dd className={lesiones?.length ? 'rx-value--danger' : undefined}>{Array.isArray(lesiones) && lesiones.length > 0 ? lesiones.join(', ') : cliente?.perfilSalud ? 'Ninguna' : 'Sin dato'}</dd></div>
        </dl>
      </section>
      <section className="rx-reception-detail-card" aria-label="Cobertura de la reservación">
        <div className="rx-reception-membership">
          <div><p className="rx-label">Membresía</p>
            <h3>{compra?.nombre || paquete || 'Sin paquete'}</h3>
            <p>{cargando ? 'Consultando saldo…' : error ? 'No se pudo consultar el saldo.' : compra ? `Vence el ${compra.fechaFin} · ${compra.vigente ? 'Vigente' : 'Fuera de vigencia'}` : paquete ? 'Paquete asociado a esta reservación.' : 'Paga cada clase en recepción.'}</p>
          </div>
          {saldo && (ilimitado || Number(saldo.total) > 0) && <div className="rx-reception-ring" style={{ '--rx-ring-progress': `${ilimitado ? 100 : porcentaje}%`, '--rx-ring-color': ilimitado ? '#3FA34D' : porcentaje > 80 ? '#E03131' : porcentaje > 50 ? '#F08C2E' : '#3FA34D' }}>
            <span>{ilimitado ? '∞' : saldo.disponibles}<small>{ilimitado ? 'ilimitado' : `de ${saldo.total}`}</small></span>
          </div>}
        </div>
        <span className={`rx-badge rx-badge--${pagada ? 'success' : 'warning'}`}>{pagada ? 'Pago registrado' : 'Por cobrar'}</span>
      </section>
      <h3 className="rx-reception-messages-title">Mensajes importantes</h3>
      {error && <p className="rx-reception-detail-note" role="alert">{error}</p>}
      {compra && (!compra.vigente || (!ilimitado && porcentaje > 80)) && <p className="rx-reception-detail-note rx-reception-detail-note--danger">{!compra.vigente ? 'La membresía está fuera de vigencia.' : 'Quedan pocos accesos disponibles.'} Consulta las opciones de renovación.</p>}
      <div className={`rx-reception-detail-note ${pagada ? 'rx-reception-detail-note--success' : ''}`}>
        <MaterialIcon name={pagada ? 'check_circle' : 'info'} className="text-lg" />
        <span>{reserva.status === 'cancelado' ? 'Esta reservación está cancelada.' : reserva.status === 'no_asistio' ? 'El cliente no asistió a esta clase.' : espera ? 'El cliente está en lista de espera.' : reserva.status === 'asistido' ? 'Asistencia confirmada.' : pagada ? 'El pago de esta reservación está registrado.' : 'Registra el pago antes de confirmar la asistencia.'}</span>
      </div>
      {!finalizada && <div className="rx-reception-detail-total"><span>{pagada ? 'Importe registrado' : 'Total a cobrar'}</span><strong>{dinero(reserva.price)}</strong></div>}
      {cobrable && <button type="button" className="rx-btn rx-btn--dark rx-reception-primary" onClick={() => onCobrar(reserva.id)}><MaterialIcon name="point_of_sale" className="text-lg" />Cobrar reservación</button>}
      {confirmar && <button type="button" className="rx-btn rx-btn--dark rx-reception-primary" onClick={() => onAsistencia(reserva.id)}><MaterialIcon name="how_to_reg" className="text-lg" />Confirmar asistencia</button>}
      {vigente && <div className="rx-reception-detail-actions">
        <button type="button" className="rx-btn rx-btn--outline" disabled={reserva.puedeReagendar === false} title={reserva.motivoNoReagendar} onClick={() => { if (reserva.puedeReagendar !== false) onReagendar(reserva); }}>Reagendar</button>
        <button type="button" className="rx-btn rx-btn--outline" disabled={reserva.puedeCancelar === false} title={reserva.motivoNoCancelar} onClick={() => { if (reserva.puedeCancelar !== false) onCancelar(reserva.id); }}>Cancelar reservación</button>
      </div>}
      {vigente && reserva.puedeReagendar === false && <p className="rx-reception-hint">{reserva.motivoNoReagendar || 'Esta reservación no se puede reagendar.'}</p>}
      {vigente && reserva.puedeCancelar === false && <p className="rx-reception-hint">{reserva.motivoNoCancelar || 'Esta reservación no se puede cancelar.'}</p>}
    </aside>
  );
}