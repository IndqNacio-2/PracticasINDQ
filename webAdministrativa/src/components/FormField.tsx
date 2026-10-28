import { InputHTMLAttributes, SelectHTMLAttributes } from 'react';

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
}

interface InputFieldProps extends FieldProps, InputHTMLAttributes<HTMLInputElement> {}
interface SelectFieldProps extends FieldProps, SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
}
interface TextareaFieldProps extends FieldProps {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
}

const baseInput =
  'w-full px-3.5 py-2.5 text-sm text-[color:var(--ink)] border-[1.5px] border-[color:var(--line)] rounded-2xl bg-white placeholder:text-[color:var(--ink3)] ' +
  'focus:outline-none focus:border-[color:var(--ink)] transition-colors';
const errorInput = 'border-[color:var(--bad)]';
const labelClass = 'block text-sm font-semibold text-[color:var(--ink)]';

function Label({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className={labelClass}>
      {label}{required && <span className="text-[color:var(--bad)] ml-0.5">*</span>}
    </label>
  );
}

// className se aplica al contenedor del campo (por ejemplo "col-span-2" dentro de una cuadrícula)
export function InputField({ label, required, error, className, ...props }: InputFieldProps) {
  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <Label label={label} required={required} />
      <input required={required} className={`${baseInput} ${error ? errorInput : ''}`} {...props} />
      {error && <p className="text-xs text-[color:var(--bad)]">{error}</p>}
    </div>
  );
}

export function SelectField({ label, required, error, options, className, ...props }: SelectFieldProps) {
  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <Label label={label} required={required} />
      <select required={required} className={`${baseInput} ${error ? errorInput : ''}`} {...props}>
        <option value="">Seleccionar...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-xs text-[color:var(--bad)]">{error}</p>}
    </div>
  );
}

export function TextareaField({ label, required, error, value, onChange, rows = 3, placeholder, className }: TextareaFieldProps) {
  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <Label label={label} required={required} />
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={`${baseInput} resize-none ${error ? errorInput : ''}`}
      />
      {error && <p className="text-xs text-[color:var(--bad)]">{error}</p>}
    </div>
  );
}
