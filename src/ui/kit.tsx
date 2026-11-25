// Componentes del UI Kit Nuucleo v1.2 (mismas clases CSS que el prototipo).
// Patrón de cada módulo: tarjetas de resumen → título + buscador → filtros + acción principal → tabla → panel lateral.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type Tono = 'ok' | 'bad' | 'warn' | 'accent' | 'purple' | 'blue' | 'gray';
export const TONO: Record<Tono, [string, string]> = {
  ok: ['var(--ok-bg)', 'var(--ok)'],
  bad: ['var(--bad-bg)', 'var(--bad)'],
  warn: ['var(--warn-bg)', 'var(--warn)'],
  accent: ['var(--accent-soft)', 'var(--accent)'],
  purple: ['var(--purple-bg)', 'var(--purple)'],
  blue: ['var(--blue-bg)', 'var(--blue)'],
  gray: ['var(--card2)', 'var(--ink2)'],
};

/* ---------- Tarjetas de resumen ---------- */
export interface KpiItem { label: string; value: ReactNode; tono: Tono; icon: IconName }
export function Kpis({ items }: { items: KpiItem[] }) {
  return (
    <div className="kpis" style={{ gridTemplateColumns: `repeat(${items.length},minmax(0,1fr))` }}>
      {items.map((k) => (
        <div className="kpi" key={k.label}>
          <span className="ki" style={{ background: TONO[k.tono][0], color: TONO[k.tono][1] }}><Icon n={k.icon} /></span>
          <div><b>{k.value}</b><small>{k.label}</small></div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Título + buscador ---------- */
export function SecHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return <div className="sechrow"><h2 className="sech">{title}</h2>{children}</div>;
}

export function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="search">
      <Icon n="buscar" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" aria-label={placeholder} />
    </div>
  );
}

/* ---------- Pestañas, switch y periodo ---------- */
export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: [K, string, number?][]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([k, label, n]) => (
        <button key={k} role="tab" aria-selected={value === k} className={`tab ${value === k ? 'on' : ''}`} onClick={() => onChange(k)}>
          {label}{n !== undefined && <em>{n}</em>}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, bare }: { checked: boolean; onChange: (v: boolean) => void; label?: string; bare?: boolean }) {
  return (
    <label className="stog" style={bare ? { border: 0, padding: 0 } : undefined}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="sw" />{label}
    </label>
  );
}

export function Periodo<K extends string>({ opciones, value, onChange, etiqueta = 'Periodo', style }: { opciones: [K, string][]; value: K; onChange: (k: K) => void; etiqueta?: string; style?: React.CSSProperties }) {
  return (
    <div className="per" style={style}>
      {etiqueta && <span>{etiqueta}</span>}
      {opciones.map(([k, l]) => <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

/* ---------- Pills ---------- */
export const PillEstatus = ({ activo, f = false }: { activo: boolean; f?: boolean }) => (
  <span className={`pill ${activo ? 's-on' : 's-off'}`}><span className="dot" />{activo ? (f ? 'Activa' : 'Activo') : (f ? 'Inactiva' : 'Inactivo')}</span>
);

export function Avatar({ texto, foto, size }: { texto: string; foto?: string; size?: number }) {
  const st = size ? { width: size, height: size } : undefined;
  return <span className={`av ${foto ? 'ph' : ''}`} style={st}>{foto ? <img src={foto} alt="" /> : texto}</span>;
}

/* ---------- Botón de ícono (acciones de tabla) ---------- */
export function IB({ icon, tip, onClick, kind = '', na, label }: { icon: IconName; tip: string; onClick: () => void; kind?: '' | 'on' | 'off' | 'wh' | 'mv'; na?: string | false | null; label?: string }) {
  return (
    <button
      type="button"
      className={`ib ${kind} ${na ? 'na' : ''}`}
      data-tip={na || tip}
      aria-label={label ?? tip}
      aria-disabled={na ? true : undefined}
      onClick={() => { if (!na) onClick(); }}
    >
      <Icon n={icon} />
    </button>
  );
}

export function EmptyRow({ cols, title, text }: { cols: number; title: string; text: string }) {
  return <tr className="emptyrow"><td colSpan={cols}><b>{title}</b>{text}</td></tr>;
}

export function Cargando({ cols, texto = 'Cargando…' }: { cols?: number; texto?: string }) {
  if (cols) return <tr className="emptyrow"><td colSpan={cols}><span className="nu-spin" />{texto}</td></tr>;
  return <div className="dempty"><span className="nu-spin" />{texto}</div>;
}

export function ErrorBox({ mensaje, onRetry }: { mensaje: string; onRetry?: () => void }) {
  return (
    <div className="nu-error" role="alert">
      <Icon n="alerta" /><span>{mensaje}</span>
      {onRetry && <button className="btn line sm" onClick={onRetry}>Reintentar</button>}
    </div>
  );
}

/* ---------- Panel lateral ---------- */
export function Drawer({ open, onClose, title, sub, wide, children, footer, onSubmit }: {
  open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; wide?: boolean; children: ReactNode; footer?: ReactNode; onSubmit?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // onClose suele ser una función nueva en cada render: se guarda en un ref para que el efecto
  // de apertura (scroll arriba + foco en el primer campo) corra solo al abrir, no al escribir.
  const cerrar = useRef(onClose);
  cerrar.current = onClose;
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.dlg-veil.show')) cerrar.current(); };
    document.addEventListener('keydown', h);
    ref.current?.scrollTo(0, 0);
    const t = setTimeout(() => (ref.current?.querySelector('input:not([type=checkbox]):not([disabled]),select,textarea') as HTMLElement | null)?.focus(), 260);
    return () => { document.removeEventListener('keydown', h); clearTimeout(t); };
  }, [open]);
  return (
    <>
      <div className={`veil ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`drawer ${wide ? 'wide' : ''} ${open ? 'show' : ''}`} role="dialog" aria-modal={open} aria-hidden={!open}>
        <div className="dh">
          <div><h3>{title}</h3>{sub && <small>{sub}</small>}</div>
          <button className="x" onClick={onClose} aria-label="Cerrar"><Icon n="x" w={2.2} /></button>
        </div>
        <form className="db" ref={ref as never} noValidate onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}>
          {open && children}
          <button type="submit" hidden />
        </form>
        {footer && <div className="df">{footer}</div>}
      </aside>
    </>
  );
}

export function DrawerFooter({ label, onSave, onCancel, saving, icon = 'check' }: { label: string; onSave: () => void; onCancel: () => void; saving?: boolean; icon?: IconName }) {
  return (
    <>
      <button type="button" className="btn glass wide" onClick={onSave} disabled={saving}>
        {saving ? <span className="nu-spin" /> : <Icon n={icon} w={2.4} />}{saving ? 'Guardando…' : label}
      </button>
      <button type="button" className="btn cancel" onClick={onCancel}>Cancelar</button>
    </>
  );
}

/* ---------- Campo de formulario ---------- */
export function Field({ label, req, opt, error, hint, children, last, id, style }: {
  label?: ReactNode; req?: boolean; opt?: boolean; error?: string | false | null; hint?: ReactNode; children: ReactNode; last?: boolean; id?: string; style?: React.CSSProperties;
}) {
  return (
    <div className={`fld ${error ? 'err' : ''} ${last ? 'last' : ''}`} id={id} style={style}>
      {label && <label>{label}{req && <em className="req" aria-hidden="true">*</em>}{opt && <span className="opt">Opcional</span>}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
      {error && <div className="msg" style={{ display: 'block' }}>{error}</div>}
    </div>
  );
}

/* ---------- Estatus (segmento + caja) ---------- */
export function EstatusSeg({ activo, onChange, textoOn, textoOff, f, bloqueado }: {
  activo: boolean; onChange: (v: boolean) => void; textoOn: ReactNode; textoOff: ReactNode; f?: boolean; bloqueado?: ReactNode;
}) {
  return (
    <div className="strow">
      <div className="seg">
        <button type="button" data-s="1" className={activo ? 'on' : ''} onClick={() => onChange(true)}><span className="dot" />{f ? 'Activa' : 'Activo'}</button>
        <button type="button" data-s="0" className={!activo ? 'on' : ''} disabled={!!bloqueado} onClick={() => onChange(false)}><span className="dot" />{f ? 'Inactiva' : 'Inactivo'}</button>
      </div>
      <div className={`stbox ${bloqueado ? 'lock' : activo ? 'on' : 'off'}`}>
        <span className="sti"><Icon n={bloqueado ? 'candado' : activo ? 'on' : 'off'} /></span>
        <span>{bloqueado ?? (activo ? textoOn : textoOff)}</span>
      </div>
    </div>
  );
}

/* ---------- Toast + diálogo de confirmación ---------- */
interface ConfirmOpts { t: string; p?: ReactNode; y: string; n?: string; tono?: 'bad' | 'ok' | 'warn' | 'cal'; icon?: IconName }
interface Feedback {
  toast: (titulo: string, detalle?: string, tipo?: 'ok' | 'error' | 'info') => void;
  confirmar: (o: ConfirmOpts) => Promise<boolean>;
}
const Ctx = createContext<Feedback>({ toast: () => {}, confirmar: async () => false });
export const useFeedback = () => useContext(Ctx);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ titulo: string; detalle: string; tipo: string; id: number } | null>(null);
  const [show, setShow] = useState(false);
  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((titulo: string, detalle = '', tipo: 'ok' | 'error' | 'info' = 'ok') => {
    setT({ titulo, detalle, tipo, id: Date.now() });
    setShow(false);
    requestAnimationFrame(() => setShow(true));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), tipo === 'error' ? 6500 : 4500);
  }, []);
  const confirmar = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDlg({ ...o, resolve })), []);
  const cerrar = (v: boolean) => { dlg?.resolve(v); setDlg(null); };

  useEffect(() => {
    if (!dlg) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  });

  const tono = dlg?.tono ?? 'bad';
  return (
    <Ctx.Provider value={{ toast, confirmar }}>
      {children}
      <div className={`dlg-veil ${dlg ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) cerrar(false); }}>
        {dlg && (
          <div className="dlg" role="alertdialog" aria-labelledby="dlgT">
            <div className={`dic ${tono === 'ok' ? 'ok' : tono === 'warn' ? 'warn' : tono === 'cal' ? 'cal' : ''}`}><Icon n={dlg.icon ?? (tono === 'ok' ? 'on' : 'off')} /></div>
            <h5 id="dlgT">{dlg.t}</h5>
            {dlg.p && <p>{dlg.p}</p>}
            <div className="btns">
              <button className={`btn ${tono === 'bad' ? 'danger' : 'acc'}`} autoFocus onClick={() => cerrar(true)}>{dlg.y}</button>
              <button className="btn" style={{ color: 'var(--ink2)', fontWeight: 500 }} onClick={() => cerrar(false)}>{dlg.n ?? 'Cancelar'}</button>
            </div>
          </div>
        )}
      </div>
      <div className={`toast ${show ? 'show' : ''}`} role="status" aria-live="polite">
        <span className="tsic" style={t?.tipo === 'error' ? { background: 'var(--bad-bg)', color: 'var(--bad)' } : t?.tipo === 'info' ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}>
          <Icon n={t?.tipo === 'error' ? 'alerta' : t?.tipo === 'info' ? 'info' : 'check'} w={2.6} />
        </span>
        <div><b>{t?.titulo}</b>{t?.detalle && <p>{t.detalle}</p>}</div>
      </div>
    </Ctx.Provider>
  );
}

/* ---------- Carga de datos ---------- */
export function useCarga<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const recargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    setError(null);
    try {
      setData(await fnRef.current());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la información.');
    } finally {
      setLoading(false);
    }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void recargar(); }, deps);
  return { data, setData, error, loading, recargar };
}
