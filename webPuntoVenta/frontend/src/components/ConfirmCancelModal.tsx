export default function ConfirmCancelModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="modal-enter bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[#FEF2F2] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#EF4444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[#0D0F14] mb-2">¿Deseas cancelar la venta actual?</h2>
          <p className="text-sm text-[#6B7280]">Todos los productos del carrito serán eliminados.</p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onCancel}
            className="w-full py-3 bg-[#F9FAFB] border border-[#E5E7EB] text-[#374151] font-semibold rounded-xl hover:bg-[#F3F4F6] transition-colors"
          >
            Continuar venta
          </button>
          <button
            onClick={onConfirm}
            className="w-full py-3 bg-[#EF4444] text-white font-bold rounded-xl hover:bg-[#DC2626] transition-colors"
          >
            Cancelar venta
          </button>
        </div>
      </div>
    </div>
  );
}
