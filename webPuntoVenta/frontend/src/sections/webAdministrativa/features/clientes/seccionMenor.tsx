import { InputField } from '../../components/FormField';
import './MenorDiseño.css';

// Los 4 documentos (copias) que se piden al registrar a un menor de edad. Se piden una sola vez:
// renovar o comprar otra membresía no vuelve a pedirlos. Las claves son las que guarda el servidor.
export const DOCUMENTOS_MENOR = [
    { clave: 'actaNacimiento', etiqueta: 'Acta de nacimiento del menor' },
    { clave: 'ineTutor', etiqueta: 'INE del padre, madre o tutor' },
    { clave: 'curpMenor', etiqueta: 'CURP del menor' },
    { clave: 'credencialEscolar', etiqueta: 'Credencial escolar del menor' },
] as const;

export type ClaveDocumento = (typeof DOCUMENTOS_MENOR)[number]['clave'];
export type DocumentosMenor = Record<ClaveDocumento, boolean>;

export const documentosVacios = (): DocumentosMenor => ({
    actaNacimiento: false, ineTutor: false, curpMenor: false, credencialEscolar: false,
});

/** Documentos que llegan del servidor (pueden faltar campos o venir null). */
export const documentosDe = (origen?: Partial<Record<string, boolean>> | null): DocumentosMenor => ({
    ...documentosVacios(),
    ...Object.fromEntries(DOCUMENTOS_MENOR.map(d => [d.clave, origen?.[d.clave] === true])),
});

export const contarDocumentos = (documentos: DocumentosMenor) =>
    DOCUMENTOS_MENOR.filter(d => documentos[d.clave]).length;

interface Props {
    nombreTutor: string;
    claveElector: string;
    documentos: DocumentosMenor;
    onNombre: (valor: string) => void;
    onClaveElector: (valor: string) => void;
    onDocumentos: (valor: DocumentosMenor) => void;
}

export function SeccionMenor({ nombreTutor, claveElector, documentos, onNombre, onClaveElector, onDocumentos }: Props) {
    const entregados = contarDocumentos(documentos);
    const completo = entregados === DOCUMENTOS_MENOR.length;

    return (
        <section className="rx-menor" aria-labelledby="menor-titulo">
            <div className="rx-menor__encabezado">
                <h3 id="menor-titulo" className="rx-menor__titulo">Padre, madre o tutor</h3>
                <span className="rx-menor__etiqueta">Menor de edad</span>
            </div>

            <div className="rx-menor__tarjeta">
                <InputField
                    label="Nombre del padre, madre o tutor"
                    required
                    maxLength={200}
                    autoComplete="off"
                    placeholder="Nombre completo"
                    value={nombreTutor}
                    onChange={e => onNombre(e.target.value)}
                />
                <div>
                    <InputField
                        label="Número de INE"
                        required
                        maxLength={18}
                        autoComplete="off"
                        placeholder="CLAVE DE ELECTOR"
                        value={claveElector}
                        onChange={e => onClaveElector(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    />
                    <p className="rx-menor__aviso">Clave de elector de 18 caracteres.</p>
                </div>

                <hr className="rx-menor__separador" />

                <div className="rx-menor__copias">
                    <h4 className="rx-menor__copias-titulo">Copias entregadas</h4>
                    <span className={`rx-menor__contador ${completo ? 'rx-menor__contador--completo' : ''}`} role="status">
                        {entregados} de {DOCUMENTOS_MENOR.length}
                    </span>
                </div>
                <fieldset className="rx-menor__lista" aria-label="Copias entregadas">
                    {DOCUMENTOS_MENOR.map(d => (
                        <label key={d.clave} className="rx-menor__documento">
                            <input
                                type="checkbox"
                                checked={documentos[d.clave]}
                                onChange={e => onDocumentos({ ...documentos, [d.clave]: e.target.checked })}
                            />
                            <span>{d.etiqueta}</span>
                        </label>
                    ))}
                </fieldset>
            </div>
        </section>
    );
}