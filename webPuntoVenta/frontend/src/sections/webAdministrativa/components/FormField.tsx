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

const baseInput = 'rx-input';

export function InputField({ label, required, error, className, ...props }: InputFieldProps) {
  return (
    <div className={`rx-field ${className ?? ''}`}>
      <label className="rx-label">
        {label}{required && <span className="rx-required-mark">*</span>}
      </label>
      <input className={`${baseInput} ${error ? 'rx-input--error' : ''}`} {...props} />
      {error && <p className="rx-error-text">{error}</p>}
    </div>
  );
}

export function SelectField({ label, required, error, options, className, ...props }: SelectFieldProps) {
  return (
    <div className={`rx-field ${className ?? ''}`}>
      <label className="rx-label">
        {label}{required && <span className="rx-required-mark">*</span>}
      </label>
      <select className={`rx-select ${error ? 'rx-input--error' : ''}`} {...props}>
        <option value="">Seleccionar...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="rx-error-text">{error}</p>}
    </div>
  );
}

export function TextareaField({ label, required, error, value, onChange, rows = 3, placeholder }: TextareaFieldProps) {
  return (
    <div className="rx-field">
      <label className="rx-label">
        {label}{required && <span className="rx-required-mark">*</span>}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={`${baseInput} rx-textarea ${error ? 'rx-input--error' : ''}`}
      />
      {error && <p className="rx-error-text">{error}</p>}
    </div>
  );
}
