import { ReactNode, useEffect, useId } from 'react';
import { Icon } from './Icon';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'reception';
  subtitle?: string;
  footer?: ReactNode;
}

const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Modal({ open, onClose, title, children, size = 'md', variant = 'default', subtitle, footer }: ModalProps) {
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
    <div className="rx-modal-layer rx-admin-modal">
      <div className="rx-modal-backdrop" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={variant === 'reception' ? 'rx-modal rx-modal--scroll modal-enter' : `rx-modal-panel ${sizes[size]}`}>
        <div className="rx-modal-header">
          <div>
            <h2 id={titleId} className={variant === 'reception' ? 'rx-modal-title' : undefined}>{title}</h2>
            {subtitle && <p className="rx-modal-subtitle rx-modal-subtitle--plain">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={variant === 'reception' ? 'rx-modal-close' : 'rx-icon-btn'}
            aria-label="Cerrar"
          >
            <Icon name="close" size={20} weight={500} />
          </button>
        </div>
        {variant === 'reception' ? children : <div className="rx-modal-body">{children}</div>}
        {footer && <footer className="rx-modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}