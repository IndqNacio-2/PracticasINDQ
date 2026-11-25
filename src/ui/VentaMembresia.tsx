import { useEffect, useMemo, useState } from 'react';
import { cobro, mensajeError } from '../lib/api';
import { clientes as apiClientes, type Cliente } from '../lib/datos';
import { coincideNombre, fechaCorta, hoyClave, money, uuid } from '../lib/format';
import { CobroDrawer, type Ticket } from './Cobro';
import { Field, useFeedback } from './kit';
import { Icon } from './Icon';

export interface Opcion { id: string; entradas: number | null; duracion?: number; unidadDuracion?: 'dias' | 'meses'; vigenciaDias?: number; distribucion?: 'compartida' | 'por_clase'; entradasPorClase?: Record<string, number>; costo: number | null }
export interface Membresia {
  idMembresia: string; nombre: string; descripcion: string; estatus: 'activo' | 'inactivo'; accesos: string[]; clasesIds?: string[];
  opciones: Opcion[]; complementos: { locker: boolean; regaderas: boolean; preventas: boolean; descuento: { porcentaje: number; aplicaEn: string } | null };
  kit: { productos: string[]; cortesias: string[] } | null;
}
type ClienteMin = Cliente;

export const optEntradas = (o: Opcion) => (o.entradas === null ? 'Ilimitado' : `${o.entradas} entrada${o.entradas === 1 ? '' : 's'}`);
export const optVigencia = (o: Opcion) => {
  const n = o.duracion ?? o.vigenciaDias ?? 0, u = o.unidadDuracion ?? 'dias';
  return `${n} ${u === 'meses' ? (n === 1 ? 'mes' : 'meses') : n === 1 ? 'día' : 'días'}`;
};

/** Vende una membresía en recepción: elige cliente y presentación, cobra y entrega el comprobante. */
export function VentaMembresia({ open, onClose, membresia, onVendida }: { open: boolean; onClose: () => void; membresia: Membresia | null; onVendida: (t: Ticket) => void }) {
  const { toast } = useFeedback();
  const [clientes, setClientes] = useState<ClienteMin[]>([]);
  const [q, setQ] = useState('');
  const [cli, setCli] = useState<ClienteMin | null>(null);
  const [op, setOp] = useState<string>('');
  const [inicio, setInicio] = useState(hoyClave());
  const [solicitud, setSolicitud] = useState(uuid());

  useEffect(() => {
    if (!open) return;
    setQ(''); setCli(null); setInicio(hoyClave()); setSolicitud(uuid());
    setOp(membresia?.opciones.find((o) => o.costo !== null)?.id ?? '');
    apiClientes.listar().then((l) => setClientes(l.filter((c) => c.estatus === 'activo'))).catch(() => setClientes([]));
  }, [open, membresia]);

  const sugeridos = useMemo(() => (q.trim() ? clientes.filter((c) => coincideNombre(`${c.nombre} ${c.apellidos}`, q)).slice(0, 6) : []), [q, clientes]);
  const opcion = membresia?.opciones.find((o) => o.id === op);

  const cobrar = async (p: { metodoPago: string; efectivoRecibido?: number; referencia?: string }) => {
    if (!cli || !membresia || !opcion) { toast('Faltan datos', 'Elige el cliente y la presentación.', 'error'); return; }
    try {
      const r = await cobro.post<{ compraId: string; ticket: Ticket }>('/membresias/compras', {
        clienteId: Number(cli.idUsuario), membresiaId: membresia.idMembresia, opcionId: opcion.id, solicitudId: solicitud, fechaInicio: inicio, ...p,
      });
      onVendida(r.ticket);
      toast('Membresía vendida', `${cli.nombre} ${cli.apellidos}: ${membresia.nombre}.`);
    } catch (e) { toast('No se pudo cobrar', mensajeError(e), 'error'); }
  };

  return (
    <CobroDrawer open={open} onClose={onClose} titulo="Vender membresía" sub={membresia?.nombre} total={Number(opcion?.costo ?? 0)} onCobrar={cobrar}
      resumen={<>
        <Field label="Cliente" req>
          {cli ? (
            <div className="nu-pick"><span><b>{cli.nombre} {cli.apellidos}</b>{!!cli.tutor && <small>{cli.menorValidado ? 'Menor · documentos validados' : 'Menor · documentos pendientes de validar'}</small>}</span>
              <button type="button" className="plink" onClick={() => setCli(null)}>Cambiar</button></div>
          ) : (
            <div className="nu-combo"><div className="hadd"><input placeholder="Buscar por nombre y/o apellido" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              {sugeridos.length > 0 && <ul className="nu-opts">{sugeridos.map((c) => <li key={c.idUsuario} onMouseDown={(e) => { e.preventDefault(); setCli(c); }}>{c.nombre} {c.apellidos}</li>)}</ul>}</div>
          )}
        </Field>
        <Field label="Presentación" req>
          <div className="slots">
            {membresia?.opciones.filter((o) => o.costo !== null).map((o) => (
              <button type="button" key={o.id} className={`slot ${op === o.id ? 'on' : ''}`} onClick={() => setOp(o.id)}>
                <span><b>{optEntradas(o)}</b><small>Vigencia de {optVigencia(o)}</small></span><span className="cap" style={{ color: 'var(--ink)' }}>{money(o.costo)}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Empieza el" last hint={`Los meses cuentan como meses de calendario. Hoy es ${fechaCorta(hoyClave())}.`}>
          <input type="date" min={hoyClave()} value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </Field>
        {cli && !!cli.tutor && !cli.menorValidado && (
          <div className="stbox warnb"><span className="sti"><Icon n="alerta" /></span><span>Es menor de edad y aún no se validan sus documentos. Pídelos una sola vez y márcalo como validado en Clientes.</span></div>
        )}
      </>} />
  );
}
