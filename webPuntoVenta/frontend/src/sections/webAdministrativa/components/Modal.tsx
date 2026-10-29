import { ReactNode, useEffect, useId } from 'react';
import { Icon } from './Icon';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', cerrarConEscape);
    return () => {
      document.removeEventListener('keydown', cerrarConEscape);
      document.body.style.overflow = '';
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="rx-modal-layer">
      <div className="rx-modal-backdrop" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`rx-modal-panel ${sizes[size]}`}>
        <div className="rx-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button
            onClick={onClose}
            className="rx-modal-close"
            aria-label="Cerrar"
          >
            <Icon name="close" size={20} weight={500} />
          </button>
        </div>
        <div className="rx-modal-body">{children}</div>
      </div>
    </div>
  );
}