import { useState } from 'react';
import { TOKEN_KEY } from '../auth/session';
import MaterialIcon from './MaterialIcon';

// Solicita el fondo al iniciar sesión; se comparte con el corte del vendedor.
export default function FondoRecordatorio({ userId, amount, onChange }: {
  userId: string;
  amount: number | null;
  onChange: (amount: number | null) => void;
}) {
  const key = `pos:fondo-recordatorio:${userId}`;
  const promptKey = `${key}:sesion`;
  const token = localStorage.getItem(TOKEN_KEY) ?? '';
  const [open, setOpen] = useState(() => sessionStorage.getItem(promptKey) !== token);
  const [text, setText] = useState(() => amount === null ? '' : String(amount));
  const [error, setError] = useState('');
  const dismiss = () => { sessionStorage.setItem(promptKey, token); setOpen(false); setError(''); };
  const save = () => {
    const number = Number(text);
    if (!text.trim() || !Number.isFinite(number) || number < 0 || Math.abs(number * 100 - Math.round(number * 100)) > 0.000001) {
      setError('Escribe un importe válido, sin negativos y con máximo dos decimales.'); return;
    }
    try { onChange(number); dismiss(); }
    catch { setError('No se pudo guardar el recordatorio en este navegador.'); }
  };
  return <>
    {open && <div className="rx-modal-overlay"><section className="rx-modal" role="dialog" aria-modal="true" aria-labelledby="fund-reminder-title">
      <header className="rx-modal-header"><h2 id="fund-reminder-title" className="rx-modal-title">¿Con cuánto fondo vas a iniciar?</h2><button type="button" className="rx-modal-close" aria-label="Cerrar recordatorio de fondo" onClick={dismiss}><MaterialIcon name="close" /></button></header>
      <form onSubmit={event => { event.preventDefault(); save(); }}>
        <div className="rx-modal-body"><p className="rx-page-subtitle">Este importe será el fondo inicial de tu corte de caja. No se registra como venta y puedes editarlo o quitarlo antes de cerrar el corte.</p>
          <label className="rx-field"><span className="rx-label">Fondo inicial ($)</span><input autoFocus type="number" min="0" step="0.01" className="rx-input" value={text} onChange={event => setText(event.target.value)} /></label>
          {error && <p role="alert" className="rx-error-text">{error}</p>}
        </div>
        <footer className="rx-modal-footer"><button type="button" className="rx-btn rx-btn--outline" onClick={dismiss}>Ahora no</button><button type="submit" className="rx-btn rx-btn--dark">Guardar fondo</button></footer>
      </form>
    </section></div>}
  </>;
}