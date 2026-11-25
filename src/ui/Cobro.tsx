import { useEffect, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { Drawer, Field } from './kit';
import { fechaCorta, horaDe, money } from '../lib/format';

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia';
export interface DatosPago { metodoPago: MetodoPago; efectivoRecibido?: number; referencia?: string }

const METODOS: [MetodoPago, string, IconName, string][] = [
  ['efectivo', 'Efectivo', 'dinero', 'Calcula el cambio'],
  ['tarjeta', 'Tarjeta', 'tarjeta', 'Débito o crédito en terminal'],
  ['transferencia', 'Transferencia', 'transferencia', 'Captura la referencia'],
];

/** Panel lateral de cobro: mismo flujo en Recepción, Membresías y Punto de venta. */
export function CobroDrawer({ open, onClose, titulo, sub, total, resumen, onCobrar, extra, etiqueta = 'Cobrar' }: {
  open: boolean; onClose: () => void; titulo: string; sub?: ReactNode; total: number; resumen: ReactNode;
  onCobrar: (p: DatosPago) => Promise<void>; extra?: ReactNode; etiqueta?: string;
}) {
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [recibido, setRecibido] = useState('');
  const [ref, setRef] = useState('');
  const [err, setErr] = useState('');
  const [cobrando, setCobrando] = useState(false);
  useEffect(() => { if (open) { setMetodo('efectivo'); setRecibido(''); setRef(''); setErr(''); } }, [open]);

  const rec = Number(recibido || 0);
  const cambio = rec - total;
  const cobrar = async () => {
    if (metodo === 'efectivo' && rec < total) { setErr(`El efectivo no alcanza: faltan ${money(total - rec)}.`); return; }
    setCobrando(true);
    try {
      await onCobrar({ metodoPago: metodo, ...(metodo === 'efectivo' ? { efectivoRecibido: rec } : {}), ...(metodo === 'transferencia' ? { referencia: ref.trim() } : {}) });
    } finally { setCobrando(false); }
  };
  return (
    <Drawer open={open} onClose={onClose} title={titulo} sub={sub} onSubmit={cobrar}
      footer={<>
        <button type="button" className="btn glass wide" disabled={cobrando || total < 0} onClick={cobrar}>
          {cobrando ? <span className="nu-spin" /> : <Icon n="check" w={2.4} />}{cobrando ? 'Cobrando…' : `${etiqueta} ${money(total)}`}
        </button>
        <button type="button" className="btn cancel" onClick={onClose}>Cancelar</button>
      </>}>
      <div className="lbl">Concepto</div>
      <div className="sbox" style={{ paddingBottom: 18 }}>{resumen}</div>
      {extra}
      <div className="lbl">Forma de pago</div>
      <div className="sbox">
        <div className="mtypes">
          {METODOS.map(([k, l, ic, d]) => (
            <button type="button" key={k} className={metodo === k ? 'on' : ''} onClick={() => { setMetodo(k); setErr(''); }}>
              <span className="mti" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon n={ic} /></span><b>{l}</b><small>{d}</small>
            </button>
          ))}
        </div>
        <div style={{ height: 14 }} />
        {metodo === 'efectivo' && (
          <Field label="Efectivo recibido" req error={err} last>
            <div className="money big"><span>$</span><input inputMode="decimal" placeholder={String(total)} value={recibido} onChange={(e) => { setRecibido(e.target.value.replace(/[^\d.]/g, '')); setErr(''); }} /></div>
            <div className="nu-quick">{[total, 100, 200, 500, 1000].filter((v, i, a) => v >= total && a.indexOf(v) === i).slice(0, 4).map((v) => (
              <button type="button" key={v} onClick={() => { setRecibido(String(v)); setErr(''); }}>{v === total ? 'Exacto' : money(v)}</button>))}</div>
          </Field>
        )}
        {metodo === 'transferencia' && (
          <Field label="Referencia" opt last><input value={ref} placeholder="Ej. 0042 3381" onChange={(e) => setRef(e.target.value)} /></Field>
        )}
        {metodo === 'tarjeta' && <p className="shint" style={{ margin: '0 0 14px' }}>Cobra en la terminal y confirma cuando el pago sea aprobado.</p>}
      </div>
      <div className={`vprev ${metodo === 'efectivo' && recibido && cambio < 0 ? 'bad' : ''}`}>
        <span>{metodo === 'efectivo' && recibido ? (cambio < 0 ? 'Falta' : 'Cambio') : 'Total a cobrar'}</span>
        <b className="after">{money(metodo === 'efectivo' && recibido ? Math.abs(cambio) : total)}</b>
      </div>
    </Drawer>
  );
}

export interface Ticket {
  folio: string; fecha: string; cliente?: string; usuario?: string | null; metodoPago: string; total: number;
  efectivoRecibido?: number | null; cambio?: number | null; referencia?: string | null; codigo?: string | null;
  items: { descripcion: string; cantidad: number; precioUnitario: number; importe: number }[];
  membresia?: string; fechaInicio?: string; fechaFin?: string; clase?: string; fechaClase?: string; horaClase?: string;
}

/** Comprobante con opción de imprimir (impresora del navegador). */
export function TicketDialog({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
  if (!ticket) return null;
  return (
    <div className="dlg-veil show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg nu-ticket" role="dialog" aria-label="Comprobante de pago">
        <div className="dic ok"><Icon n="on" /></div>
        <h5>Cobro registrado</h5>
        <div className="nu-tk" id="nu-ticket-print">
          <img src="/branding/nuucleo-logo-blanco.png" alt="Nuucleo" />
          <div className="tkr"><span>Folio</span><b className="mono">{ticket.folio}</b></div>
          <div className="tkr"><span>Fecha</span><b>{fechaCorta(ticket.fecha)} · {horaDe(ticket.fecha)}</b></div>
          {ticket.cliente && <div className="tkr"><span>Cliente</span><b>{ticket.cliente}</b></div>}
          {ticket.codigo && <div className="tkr"><span>Código</span><b className="mono">{ticket.codigo}</b></div>}
          {ticket.membresia && <div className="tkr"><span>Vigencia</span><b>{fechaCorta(ticket.fechaInicio)} – {fechaCorta(ticket.fechaFin)}</b></div>}
          {ticket.clase && <div className="tkr"><span>Clase</span><b>{ticket.clase} · {fechaCorta(ticket.fechaClase)} {ticket.horaClase}</b></div>}
          <div className="tksep" />
          {ticket.items.map((i, k) => <div className="tkr" key={k}><span>{i.cantidad} × {i.descripcion}</span><b>{money(i.importe)}</b></div>)}
          <div className="tksep" />
          <div className="tkr tot"><span>Total</span><b>{money(ticket.total)}</b></div>
          <div className="tkr"><span>Pago</span><b style={{ textTransform: 'capitalize' }}>{ticket.metodoPago}</b></div>
          {ticket.efectivoRecibido != null && <div className="tkr"><span>Recibido</span><b>{money(ticket.efectivoRecibido)}</b></div>}
          {ticket.cambio != null && <div className="tkr"><span>Cambio</span><b>{money(ticket.cambio)}</b></div>}
          {ticket.referencia && <div className="tkr"><span>Referencia</span><b>{ticket.referencia}</b></div>}
          {ticket.usuario && <div className="tkr"><span>Atendió</span><b>{ticket.usuario}</b></div>}
        </div>
        <div className="btns">
          <button className="btn acc" onClick={() => window.print()}><Icon n="imprimir" />Imprimir comprobante</button>
          <button className="btn" style={{ color: 'var(--ink2)', fontWeight: 500 }} onClick={onClose}>Listo</button>
        </div>
      </div>
    </div>
  );
}
