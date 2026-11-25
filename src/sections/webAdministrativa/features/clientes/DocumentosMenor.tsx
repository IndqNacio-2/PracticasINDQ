import { InputField } from '../../components/FormField';

export const DOCUMENTOS_MENOR = [
  ['actaNacimiento', 'Acta de nacimiento del menor'],
  ['ineTutor', 'INE del padre, madre o tutor'],
  ['curp', 'CURP del menor'],
  ['credencialEscolar', 'Credencial escolar del menor'],
] as const;
export type DocumentosMenor = Record<typeof DOCUMENTOS_MENOR[number][0], boolean>;
export const DOCUMENTOS_VACIOS: DocumentosMenor = {
  actaNacimiento: false, ineTutor: false, curp: false, credencialEscolar: false,
};

interface Props {
  nombre: string;
  clave: string;
  documentos: DocumentosMenor;
  onNombre: (valor: string) => void;
  onClave: (valor: string) => void;
  onDocumentos: (valor: DocumentosMenor) => void;
}

export function ApartadoMenor({ nombre, clave, documentos, onNombre, onClave, onDocumentos }: Props) {
  const entregados = DOCUMENTOS_MENOR.filter(([campo]) => documentos[campo]).length;
  return (
    <section className="rx-minor-section" aria-labelledby="titulo-tutor">
      <div className="rx-minor-heading">
        <h3 id="titulo-tutor">Padre, madre o tutor</h3>
        <span className="rx-badge rx-badge--warning">Menor de edad</span>
      </div>
      <div className="rx-minor-card rx-form-stack">
        <InputField label="Nombre del padre, madre o tutor" aria-label="Nombre del padre, madre o tutor" required
          placeholder="Nombre completo" maxLength={200} value={nombre} onChange={e => onNombre(e.target.value)} />
        <div>
          <InputField label="Número de INE" aria-label="Número de INE" aria-describedby="ayuda-clave-tutor" required
            placeholder="CLAVE DE ELECTOR" maxLength={18} value={clave} onChange={e => onClave(e.target.value.toUpperCase())} />
          <p id="ayuda-clave-tutor" className="rx-help-text">Clave de elector de 18 caracteres.</p>
        </div>
        <fieldset className="rx-minor-documents">
          <legend>Copias entregadas <span className="rx-badge rx-badge--neutral" role="status">{entregados} de 4</span></legend>
          {DOCUMENTOS_MENOR.map(([campo, etiqueta]) => (
            <label key={campo} className="rx-minor-check">
              <input type="checkbox" checked={documentos[campo]} onChange={e => onDocumentos({ ...documentos, [campo]: e.target.checked })} />
              <span>{etiqueta}</span>
            </label>
          ))}
        </fieldset>
        <p className="rx-help-text">Puedes registrar al menor con copias pendientes. Su expediente se conserva para futuras renovaciones.</p>
      </div>
    </section>
  );
}