import { useRef, useState, type ReactNode } from "react"

import MaterialIcon from "./MaterialIcon"
import type { PaymentPart } from '../types'

type PayMethod = "efectivo" | "tarjeta" | "transferencia" | "mixto"

interface PaymentData {
  method: PayMethod
  payments?: PaymentPart[]

  cashReceived?: number

  transferRef?: string
}

interface PaymentModalProps {
  total: number
  context?: ReactNode

  onConfirm: (data: PaymentData) => void | Promise<void>

  onClose: () => void
}

const PAYMENT_OPTIONS: Array<{
  key: PayMethod

  label: string

  icon: string
}> = [
  { key: "efectivo", label: "Efectivo", icon: "payments" },

  { key: "tarjeta", label: "Tarjeta", icon: "credit_card" },
  { key: "mixto", label: "Mixto", icon: "call_split" },

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
  context,

  onConfirm,

  onClose,
}: PaymentModalProps) {
  /* Muestro solo los campos correspondientes al método elegido. */

  const [method, setMethod] = useState<PayMethod | null>(null)

  const [cashInput, setCashInput] = useState("")

  const [transferRef, setTransferRef] = useState("")
  const [mixedCashInput, setMixedCashInput] = useState('')
  const [mixedStep, setMixedStep] = useState<'efectivo' | 'restante'>('efectivo')
  const [remainingMethod, setRemainingMethod] = useState<'tarjeta' | 'transferencia' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const submittingRef = useRef(false)
  const mixedCash = Number(mixedCashInput)
  const remainingAmount = (Math.round(total * 100) - Math.round(mixedCash * 100)) / 100
  const validAmount = (value: string) => /^\d+(\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value))
  const canContinue = validAmount(mixedCashInput) && mixedCash > 0 && remainingAmount > 0 &&
    validAmount(cashInput) && Number(cashInput) >= mixedCash
  const payments: PaymentPart[] = remainingMethod ? [
    { method: 'efectivo', amount: mixedCash },
    { method: remainingMethod, amount: remainingAmount },
  ] : []
  const electronicMethod = method === 'mixto' ? (mixedStep === 'restante' ? remainingMethod : null) : method
  const electronicTotal = method === 'mixto' ? remainingAmount : total

  const cashReceived = Number.parseFloat(cashInput) || 0

  const change = cashReceived - (method === 'mixto' ? mixedCash : total)

  const cashInsufficient = cashInput !== "" && cashReceived < total

  const canConfirm = !submitting && (
    (method === 'mixto' && mixedStep === 'restante' && remainingMethod !== null && canContinue) || method === "tarjeta" ||
    method === "transferencia" ||
    (method === "efectivo" && cashReceived >= total))

  const handleConfirm = async () => {
    if (!method || !canConfirm || submittingRef.current) return

    submittingRef.current = true
    setSubmitting(true)
    setError('')
    try { await onConfirm({
      method,
      payments: method === 'mixto' ? payments : undefined,

      cashReceived: method === "efectivo" || (method === 'mixto' && mixedCash > 0) ? cashReceived : undefined,

      transferRef: electronicMethod === "transferencia" ? transferRef.trim() : undefined,
    }) } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo registrar el pago.') }
    finally { submittingRef.current = false; setSubmitting(false) }
  }

  /* Limpio el efectivo al volver para no conservar un intento anterior. */

  const handleBack = () => {
    if (submittingRef.current) return
    setMethod(null)

    setCashInput("")
    setMixedCashInput('')
    setMixedStep('efectivo')
    setRemainingMethod(null)
    setTransferRef('')
  }

  const handleElectronicBack = () => {
    if (submittingRef.current) return
    if (method !== 'mixto') { handleBack(); return }
    setRemainingMethod(null)
    setTransferRef('')
  }

  return (
    <div className="rx-modal-overlay" role="presentation">
      <section
        className="rx-modal rx-modal--scroll modal-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
      >
        <header className="rx-modal-header">
          <div>
            <h2 id="payment-title" className="rx-modal-title">
              Cobro
            </h2>
            {method && <p className="rx-modal-subtitle">{method === 'mixto' ? `Pago mixto · Paso ${mixedStep === 'efectivo' ? '1: efectivo' : '2: restante'}` : `Pago con ${method}`}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
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
          {context}
          {error && <p className="rx-error-text" role="alert">{error}</p>}
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

          {method === 'mixto' && mixedStep === 'efectivo' && <div>
            <BackButton onClick={handleBack} />
            <label className="rx-field mb-4"><span className="rx-label">Importe a pagar en efectivo</span>
              <input className="rx-input rx-input--amount" type="number" min="0" max={total} step="0.01" autoFocus placeholder="0.00" value={mixedCashInput} disabled={submitting}
                onChange={event => { setMixedCashInput(event.target.value); setCashInput(event.target.value) }} />
              <span className="rx-help-text">El resto se pagará con tarjeta o transferencia.</span>
              {mixedCashInput !== '' && (!validAmount(mixedCashInput) || mixedCash <= 0 || remainingAmount <= 0) &&
                <span className="rx-error-text" role="alert">Ingresa un importe mayor a cero y menor al total.</span>}
            </label>
            <label className="rx-field mb-4"><span className="rx-label">Efectivo recibido</span>
              <input className="rx-input" type="number" min="0" step="0.01" value={cashInput} disabled={submitting} onChange={event => setCashInput(event.target.value)} />
              {cashInput !== '' && cashReceived < mixedCash && <span className="rx-error-text" role="alert">El efectivo recibido es insuficiente.</span>}
            </label>
            {canContinue && <div className="rx-change-box mb-4">
              <div className="rx-change-row"><span className="rx-change-label">Cambio</span><strong className="rx-change-value">{fmt(change)}</strong></div>
              <div className="rx-change-row"><span className="rx-change-label">Restante por pagar</span><strong>{fmt(remainingAmount)}</strong></div>
            </div>}
            <button type="button" className="rx-btn rx-btn--dark rx-btn--large rx-btn--block" disabled={!canContinue || submitting}
              onClick={() => { if (canContinue && !submittingRef.current) setMixedStep('restante') }}>
              Continuar con el restante <MaterialIcon name="arrow_forward" className="text-xl" />
            </button>
          </div>}
          {method === 'mixto' && mixedStep === 'restante' && <div>
            <button type="button" className="rx-back-button" disabled={submitting} onClick={() => { if (!submittingRef.current) { setMixedStep('efectivo'); setRemainingMethod(null); setTransferRef('') } }}>
              <MaterialIcon name="arrow_back" className="text-lg" />Editar efectivo
            </button>
            <div className="rx-change-box mb-4" role="status">
              <div className="rx-change-row"><span>Efectivo</span><strong>{fmt(mixedCash)}</strong></div>
              <div className="rx-change-row"><span>Restante por pagar</span><strong>{fmt(remainingAmount)}</strong></div>
            </div>
            {!remainingMethod && <div>
              <p className="rx-label mb-3">¿Cómo se paga el restante?</p>
              <div className="rx-payment-methods">
                {PAYMENT_OPTIONS.filter(option => option.key === 'tarjeta' || option.key === 'transferencia').map(option =>
                  <button type="button" key={option.key} className="rx-payment-method" disabled={submitting}
                    onClick={() => setRemainingMethod(option.key as 'tarjeta' | 'transferencia')}>
                    <MaterialIcon name={option.icon} className="text-2xl" filled />{option.label}
                  </button>)}
              </div>
            </div>}
          </div>}
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

          {electronicMethod === "tarjeta" && (
            <div>
              <BackButton onClick={handleElectronicBack} />
              <div className="rx-payment-information">
                <MaterialIcon
                  name="credit_card"
                  className="rx-payment-information-icon text-5xl"
                />
                <p className="rx-payment-information-label">Total a cobrar</p>
                <p className="rx-payment-information-value">{fmt(electronicTotal)}</p>
                <p className="rx-payment-information-help">
                  Presenta la tarjeta en la terminal física.
                </p>
              </div>
            </div>
          )}

          {electronicMethod === "transferencia" && (
            <div>
              <BackButton onClick={handleElectronicBack} />
              <div className="rx-payment-information">
                <MaterialIcon
                  name="account_balance"
                  className="rx-payment-information-icon text-4xl"
                />
                <p className="rx-payment-information-label">
                  Total a transferir
                </p>
                <p className="rx-payment-information-value">{fmt(electronicTotal)}</p>
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

          {method && (method !== 'mixto' || (mixedStep === 'restante' && remainingMethod)) && (
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
