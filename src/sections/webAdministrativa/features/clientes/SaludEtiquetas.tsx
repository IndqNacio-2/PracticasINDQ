import { useState } from 'react';
import { InputField, SelectField } from '../../components/FormField';

export const LESIONES_PARTES = [
  { value: 'brazo', label: 'Brazo' },
  { value: 'mano', label: 'Mano' },
  { value: 'pierna', label: 'Pierna' },
  { value: 'cintura', label: 'Cintura' },
  { value: 'espalda', label: 'Espalda' },
  { value: 'hombro', label: 'Hombro' },
  { value: 'cuello', label: 'Cuello' },
  { value: 'pie', label: 'Pie' },
] as const;

function etiquetaParte(value: string) {
  return LESIONES_PARTES.find(parte => parte.value === value)?.label ?? value;
}

export function crearEntradaLesion(parte: string, descripcion: string) {
  const nombreParte = etiquetaParte(parte.trim());
  const detalle = descripcion.trim();
  return detalle ? `${nombreParte}: ${detalle}` : nombreParte;
}

export function separarEntradaLesion(entrada: string) {
  const indice = entrada.indexOf(':');
  return indice > 0
    ? { parte: entrada.slice(0, indice).trim(), descripcion: entrada.slice(indice + 1).trim() }
    : { parte: entrada.trim(), descripcion: '' };
}

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
        <input aria-label={label} value={texto} maxLength={60} className="w-full rounded-[var(--rx-radius-medium)] border border-[var(--rx-line)] px-3 py-2"
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

export function ListaLesiones({ items, onChange }: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [parte, setParte] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const agregar = () => {
    if (!parte) return;
    const entrada = crearEntradaLesion(parte, descripcion);
    if (!items.some(item => item.toLocaleLowerCase() === entrada.toLocaleLowerCase())) {
      onChange([...items, entrada]);
    }
    setParte('');
    setDescripcion('');
  };

  return <div className="rx-form-stack">
    <div className="text-sm font-medium">
      Lesiones <span className="rx-help-text">(opcional)</span>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
        <SelectField
          label="Parte del cuerpo"
          options={[...LESIONES_PARTES]}
          value={parte}
          onChange={e => setParte(e.target.value)}
        />
        <InputField
          label="Descripción breve"
          value={descripcion}
          maxLength={120}
          onChange={e => setDescripcion(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
          placeholder="Ej. dolor en el hombro derecho al hacer fuerza"
        />
      </div>
      <button type="button" className="rx-btn rx-btn--outline mt-2" disabled={!parte} onClick={agregar}>
        Agregar lesión
      </button>
    </div>
    <div className="flex flex-wrap gap-2">
      {items.length ? items.map(entrada => {
        const { parte: nombreParte, descripcion: detalle } = separarEntradaLesion(entrada);
        return <span key={entrada} className="rx-badge break-words">
          {nombreParte}{detalle ? ` — ${detalle}` : ''}
          {' '}<button type="button" aria-label={`Quitar ${nombreParte}`} onClick={() => onChange(items.filter(item => item !== entrada))}>×</button>
        </span>;
      }) : <span className="rx-help-text">Ninguna registrada</span>}
    </div>
  </div>;
}