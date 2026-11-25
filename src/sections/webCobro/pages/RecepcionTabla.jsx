import MaterialIcon from '../../../components/MaterialIcon';

export function edadCliente(cliente, hoy) {
  const nacimiento = cliente?.fechaNacimiento?.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nacimiento || '') || nacimiento > hoy) return null;
  const fecha = new Date(`${nacimiento}T12:00:00`);
  if (Number.isNaN(fecha.getTime()) || fecha.getFullYear() !== Number(nacimiento.slice(0, 4)) || fecha.getMonth() + 1 !== Number(nacimiento.slice(5, 7)) || fecha.getDate() !== Number(nacimiento.slice(8, 10))) return null;
  return Number(hoy.slice(0, 4)) - Number(nacimiento.slice(0, 4)) - (hoy.slice(5) < nacimiento.slice(5) ? 1 : 0);
}

export default function RecepcionTabla({ reservas, clientes, seleccion, onSeleccionar, hoy }) {
  const dinero = valor => Number(valor ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  return (
    <div className="rx-table-wrap">
      <table className="rx-table rx-reservations-table">
        <thead><tr>{['Código Usuario', 'Cliente', 'Código', 'Edad', 'Lesiones', 'Cobro', 'Estatus', 'Hora'].map(titulo => <th key={titulo} scope="col">{titulo}</th>)}</tr></thead>
        <tbody>{reservas.map(reserva => {
          const cliente = reserva.clienteId == null ? undefined : clientes.find(c => c.id != null && String(c.id) === String(reserva.clienteId));
          // Es el mismo formato que resuelve el checador. Nunca usar el código
          // de la reserva como identidad de un cliente o visitante.
          const codigoUsuario = reserva.type === 'visitante' || !cliente || !/^[1-9]\d*$/.test(String(cliente.id))
            ? null : (cliente.codigo || `CLI-${cliente.id}`);
          const edad = edadCliente(cliente, hoy);
          // Cobro devuelve las lesiones en la raíz; conservar el formato histórico.
          // Una lista actual vacía tiene prioridad para no revivir lesiones eliminadas.
          const lesiones = Array.isArray(cliente?.lesiones) ? cliente.lesiones : cliente?.perfilSalud?.lesiones;
          const pagada = reserva.paymentStatus === 'pagado';
          const cobrable = !pagada && ['pendiente', 'asistido'].includes(reserva.status) && reserva.capacityStatus !== 'espera';
          const estado = reserva.status === 'asistido' ? ['success', 'Asistió']
            : reserva.status === 'cancelado' ? ['neutral', 'Cancelado']
            : reserva.status === 'no_asistio' ? ['danger', 'No asistió']
            : reserva.capacityStatus === 'espera' ? ['neutral', 'Lista de espera']
            : reserva.reagendada ? ['info', 'Reagendado'] : null;
          return (
            <tr key={reserva.id} aria-selected={seleccion === reserva.id} onClick={() => onSeleccionar(reserva.id)}>
              <td><span className="rx-code" title={codigoUsuario ? 'Código para registrar entrada y salida en el checador' : undefined}>{codigoUsuario ?? '—'}</span></td>
              <td><button type="button" className="rx-reception-client-link" onClick={() => onSeleccionar(reserva.id)} aria-label={`Ver detalle de ${reserva.client}`}>{reserva.client}</button>
                <span className="rx-cell-caption">{reserva.membresiaCompraId ? 'Con paquete' : 'Sin paquete'}</span>
              </td>
              <td><span className="rx-code">{reserva.codigo || `#${reserva.id}`}</span></td>
              <td>{edad === null ? 'Sin dato' : edad < 18 ? <span className="rx-badge rx-badge--special">Menor</span> : 'Mayor'}</td>
              <td className={`rx-reception-injuries ${Array.isArray(lesiones) && lesiones.length ? 'rx-value--danger' : ''}`}>{Array.isArray(lesiones) && lesiones.length ? lesiones.join(', ') : Array.isArray(lesiones) || cliente?.perfilSalud ? 'Ninguna' : 'Sin dato'}</td>
              <td><span className={`rx-badge rx-badge--${pagada ? 'success' : cobrable ? 'warning' : 'neutral'}`}>{pagada ? 'Pagado' : cobrable ? `Por cobrar ${dinero(reserva.price)}` : 'Sin cobro registrado'}</span></td>
              <td>{estado ? <span className={`rx-badge rx-badge--${estado[0]}`}>{estado[1]}</span> : <span className="rx-reception-hint">Por llegar</span>}</td>
              <td><span className="rx-reception-table-time"><MaterialIcon name="schedule" className="text-sm" />{reserva.time || '—'}</span></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}