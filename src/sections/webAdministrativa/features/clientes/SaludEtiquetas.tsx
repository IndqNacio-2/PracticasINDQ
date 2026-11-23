import { useState } from 'react';

export function SaludEtiquetas({ items = [] }: { items?: string[] }) {
  return <div className="flex flex-wrap gap-1" title={items.join(', ')}>
    {items.length ? items.map(item => <span key={item} className="rx-badge break-words">{item}</span>) : <span className="rx-help-text">Ninguna registrada</span>}
  </div>;
}

// Adaptación de las listas de UnionApp al formulario actual de Recepción.
export default function ListaSalud({ label, items, onChange }: {
  label: string; items: string[]; onChange: (items: string[]) => void;
}) {
  const [texto, setTexto] = useState('');
  const agregar = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    if (!items.some(item => item.toLocaleLowerCase() === limpio.toLocaleLowerCase())) onChange([...items, limpio]);
    setTexto('');
  };
  return <div className="rx-form-stack">
    <div className="text-sm font-medium">
      {label} <span className="rx-help-text">(opcional)</span>
      <div className="flex gap-2 mt-2">
        <input aria-label={label} value={texto} maxLength={60} className="w-full rounded-xl border border-gray-200 px-3 py-2"
          placeholder="Escribe y presiona Enter o Agregar"
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
          onBlur={agregar} />
        <button type="button" className="rx-btn rx-btn--outline" aria-label={`Agregar a ${label.toLowerCase()}`} disabled={!texto.trim()} onClick={agregar}>Agregar</button>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      {items.map(item => <span key={item} className="rx-badge">
        {item} <button type="button" aria-label={`Quitar ${item}`} onClick={() => onChange(items.filter(valor => valor !== item))}>×</button>
      </span>)}
    </div>
  </div>;
}