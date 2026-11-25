import MaterialIcon from './MaterialIcon';

export default function ConfirmCancelModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="modal-enter rx-modal-panel w-full max-w-sm p-[var(--rx-card-padding)] overflow-y-auto">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[var(--rx-danger-bg)] rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon name="warning" className="text-3xl text-[color:var(--rx-danger)]" filled />
          </div>
          <h2 className="text-lg font-bold text-[color:var(--rx-ink)] mb-2">¿Deseas cancelar la venta actual?</h2>
          <p className="text-sm text-[color:var(--rx-ink-secondary)]">Todos los productos del carrito serán eliminados.</p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rx-btn rx-btn--outline rx-btn--block"
          >
            Continuar venta
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rx-btn rx-btn--danger rx-btn--block"
          >
            Cancelar venta
          </button>
        </div>
      </div>
    </div>
  );
}
