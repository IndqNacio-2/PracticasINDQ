import type { ToastMessage } from "../types"

import MaterialIcon from "./MaterialIcon"

const ICONS: Record<ToastMessage["type"], string> = {
  success: "check_circle",

  error: "cancel",

  warning: "warning",

  info: "info",
}

export default function ToastContainer({ toasts }: { toasts: ToastMessage[] }) {
  return (
    <div className="rx-toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rx-toast rx-toast--${toast.type} toast-enter`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          <span className="rx-toast-icon">
            <MaterialIcon name={ICONS[toast.type]} className="text-xl" filled />
          </span>
          <p className="rx-toast-message">{toast.message}</p>
        </div>
      ))}
    </div>
  )
}
