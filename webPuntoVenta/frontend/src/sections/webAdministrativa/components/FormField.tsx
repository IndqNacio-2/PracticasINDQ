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
}

const baseInput = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all';

export function InputField({ label, required, error, className, ...props }: InputFieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input className={`${baseInput} ${error ? 'border-red-300 ring-red-200' : ''} ${className ?? ''}`} {...props} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function SelectField({ label, required, error, options, ...props }: SelectFieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select className={`${baseInput} ${error ? 'border-red-300' : ''}`} {...props}>
        <option value="">Seleccionar...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function TextareaField({ label, required, error, value, onChange, rows = 3, placeholder }: TextareaFieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={`${baseInput} resize-none ${error ? 'border-red-300' : ''}`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
