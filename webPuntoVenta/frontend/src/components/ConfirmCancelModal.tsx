import MaterialIcon from './MaterialIcon';

export default function ConfirmCancelModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="modal-enter bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[#FEF2F2] rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon name="warning" className="text-3xl text-[#EF4444]" filled />
          </div>
          <h2 className="text-lg font-bold text-[#0D0F14] mb-2">¿Deseas cancelar la venta actual?</h2>
          <p className="text-sm text-[#6B7280]">Todos los productos del carrito serán eliminados.</p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-3 bg-[#F9FAFB] border border-[#E5E7EB] text-[#374151] font-semibold rounded-xl hover:bg-[#F3F4F6] transition-colors"
          >
            Continuar venta
          </button>
          <button
            type="button"
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
