import type { ToastMessage } from '../types';
import MaterialIcon from './MaterialIcon';

const CONFIGS = {
  success: { icon: 'check_circle', bar: '#10B981', text: '#065F46', bg: '#F0FDF4' },
  error: { icon: 'cancel', bar: '#EF4444', text: '#991B1B', bg: '#FEF2F2' },
  warning: { icon: 'warning', bar: '#F59E0B', text: '#92400E', bg: '#FFFBEB' },
  info: { icon: 'info', bar: '#3B82F6', text: '#1E40AF', bg: '#EFF6FF' },
};

export default function ToastContainer({ toasts }: { toasts: ToastMessage[] }) {
  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => {
        const cfg = CONFIGS[toast.type];
        return (
          <div
            key={toast.id}
            className="toast-enter flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border border-white/50 min-w-[220px] max-w-[300px]"
            style={{ backgroundColor: cfg.bg, borderLeftWidth: 3, borderLeftColor: cfg.bar }}
          >
            <span className="flex flex-shrink-0 items-center justify-center" style={{ color: cfg.bar }}>
              <MaterialIcon name={cfg.icon} className="text-xl" filled />
            </span>
            <p className="text-sm font-medium" style={{ color: cfg.text }}>{toast.message}</p>
          </div>
        );
      })}
    </div>
  );
}
