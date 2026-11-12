import { useState } from "react"

import MaterialIcon from "./MaterialIcon"

type PayMethod = "efectivo" | "tarjeta" | "transferencia"

interface PaymentData {
  method: PayMethod

  cashReceived?: number

  transferRef?: string
}

interface PaymentModalProps {
  total: number

  onConfirm: (data: PaymentData) => void

  onClose: () => void
}

const PAYMENT_OPTIONS: Array<{
  key: PayMethod

  label: string

  icon: string
}> = [
  { key: "efectivo", label: "Efectivo", icon: "payments" },

  { key: "tarjeta", label: "Tarjeta", icon: "credit_card" },

  {
    key: "transferencia",

    label: "Transferencia",

    icon: "account_balance",
  },
]

const fmt = (value: number) => `$${value.toFixed(2)}`

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rx-back-button">
      <MaterialIcon name="arrow_back" className="text-lg" />
      Cambiar método
    </button>
  )
}

export default function PaymentModal({
  total,

  onConfirm,

  onClose,
}: PaymentModalProps) {
  /* Muestro solo los campos correspondientes al método elegido. */

  const [method, setMethod] = useState<PayMethod | null>(null)

  const [cashInput, setCashInput] = useState("")

  const [transferRef, setTransferRef] = useState("")

  const cashReceived = Number.parseFloat(cashInput) || 0

  const change = cashReceived - total

  const cashInsufficient = cashInput !== "" && cashReceived < total

  const canConfirm =
    method === "tarjeta" ||
    method === "transferencia" ||
    (method === "efectivo" && cashReceived >= total)

  const handleConfirm = () => {
    if (!method || !canConfirm) return

    onConfirm({
      method,

      cashReceived: method === "efectivo" ? cashReceived : undefined,

      transferRef: method === "transferencia" ? transferRef.trim() : undefined,
    })
  }

  /* Limpio el efectivo al volver para no conservar un intento anterior. */

  const handleBack = () => {
    setMethod(null)

    setCashInput("")
  }

  return (
    <div className="rx-modal-overlay" role="presentation">
      <section
        className="rx-modal modal-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
      >
        <header className="rx-modal-header">
          <div>
            <h2 id="payment-title" className="rx-modal-title">
              Cobro
            </h2>
            {method && <p className="rx-modal-subtitle">Pago con {method}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de cobro"
            className="rx-modal-close"
          >
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </header>

        <div className="rx-payment-total-banner">
          <p className="rx-payment-total-label">Total a pagar</p>
          <p className="rx-payment-total-value">{fmt(total)}</p>
        </div>

        <div className="rx-modal-body">
          {!method && (
            <div>
              <p className="rx-label mb-3">Método de pago</p>
              <div className="rx-payment-methods">
                {PAYMENT_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setMethod(option.key)}
                    className="rx-payment-method"
                  >
                    <MaterialIcon
                      name={option.icon}
                      className="text-2xl"
                      filled
                    />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {method === "efectivo" && (
            <div>
              <BackButton onClick={handleBack} />
              <label className="rx-field mb-4">
                <span className="rx-label">Efectivo recibido</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={cashInput}
                  onChange={(event) => setCashInput(event.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className={`rx-input rx-input--amount ${
                    cashInsufficient ? "rx-input--error" : ""
                  }`}
                />
                {cashInsufficient && (
                  <span className="rx-error-text" role="alert">
                    <MaterialIcon name="warning" className="text-base" filled />
                    El efectivo es insuficiente
                  </span>
                )}
              </label>

              {cashInput !== "" && cashReceived >= total && (
                <div className="rx-change-box">
                  <div className="rx-change-row">
                    <span className="rx-change-label">Cambio</span>
                    <strong className="rx-change-value">{fmt(change)}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {method === "tarjeta" && (
            <div>
              <BackButton onClick={handleBack} />
              <div className="rx-payment-information">
                <MaterialIcon
                  name="credit_card"
                  className="rx-payment-information-icon text-5xl"
                />
                <p className="rx-payment-information-label">Total a cobrar</p>
                <p className="rx-payment-information-value">{fmt(total)}</p>
                <p className="rx-payment-information-help">
                  Presenta la tarjeta en la terminal física.
                </p>
              </div>
            </div>
          )}

          {method === "transferencia" && (
            <div>
              <BackButton onClick={handleBack} />
              <div className="rx-payment-information">
                <MaterialIcon
                  name="account_balance"
                  className="rx-payment-information-icon text-4xl"
                />
                <p className="rx-payment-information-label">
                  Total a transferir
                </p>
                <p className="rx-payment-information-value">{fmt(total)}</p>
              </div>
              <label className="rx-field mb-4">
                <span className="rx-label">Referencia de transferencia</span>
                <input
                  type="text"
                  value={transferRef}
                  onChange={(event) => setTransferRef(event.target.value)}
                  placeholder="Ej. TRF-20261026-001"
                  className="rx-input"
                />
                <span className="rx-help-text">La referencia es opcional.</span>
              </label>
            </div>
          )}

          {method && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="rx-btn rx-btn--dark rx-btn--large rx-btn--block"
            >
              <MaterialIcon name="check_circle" className="text-xl" />
              Confirmar pago
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
