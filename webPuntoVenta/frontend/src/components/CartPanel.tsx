import type { CartItem, Product } from "../types"

import MaterialIcon from "./MaterialIcon"

const fmt = (value: number) => `$${value.toFixed(2)}`

interface CartPanelProps {
  cart: CartItem[]

  products: Product[]

  subtotal: number

  discount: number

  total: number

  onUpdateQuantity: (productId: number, delta: number) => void

  onRemove: (productId: number) => void

  onCobrar: () => void

  onCancelVenta: () => void
}

export default function CartPanel({
  cart,

  products,

  subtotal,

  discount,

  total,

  onUpdateQuantity,

  onRemove,

  onCobrar,

  onCancelVenta,
}: CartPanelProps) {
  /* Localizo la información completa del producto mediante su identificador. */

  const getProduct = (id: number) =>
    products.find((product) => product.id === id)!

  /* Cuento unidades y no solo renglones del carrito. */

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <aside className="rx-cart-panel">
      <header className="rx-cart-header">
        <div>
          <h2 className="rx-cart-title">Venta actual</h2>
          <p className="rx-sale-subtitle">
            Revisa los productos antes de cobrar
          </p>
        </div>

        {cart.length > 0 && (
          <span className="rx-badge rx-badge--accent">
            {totalItems} {totalItems === 1 ? "artículo" : "artículos"}
          </span>
        )}
      </header>

      <div className="rx-cart-items">
        {cart.length === 0 ? (
          <div className="rx-empty-state">
            <div className="rx-empty-icon">
              <MaterialIcon name="shopping_cart" className="text-3xl" />
            </div>
            <p className="rx-empty-title">La venta está vacía</p>
            <p className="rx-help-text">
              Agrega productos para comenzar una venta.
            </p>
          </div>
        ) : (
          <div className="rx-cart-list">
            {cart.map((item) => {
              const product = getProduct(item.productId)

              return (
                <article key={item.productId} className="rx-cart-item">
                  <div className="rx-cart-item-header">
                    <div className="rx-cart-product">
                      <div className="rx-cart-product-icon">
                        <MaterialIcon
                          name={product.icon}
                          className="text-xl"
                          filled
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="rx-cart-product-name">{product.name}</h3>
                        <p className="rx-cart-product-price">
                          {fmt(product.price)} por unidad
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemove(item.productId)}
                      aria-label={`Eliminar ${product.name} del carrito`}
                      className="rx-remove-button"
                    >
                      <MaterialIcon name="close" className="text-base" />
                    </button>
                  </div>

                  <div className="rx-cart-item-footer">
                    <div className="rx-quantity-control">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.productId, -1)}
                        aria-label={`Disminuir cantidad de ${product.name}`}
                        className="rx-quantity-button"
                      >
                        <MaterialIcon name="remove" className="text-lg" />
                      </button>
                      <span className="rx-quantity-value">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.productId, 1)}
                        disabled={item.quantity >= product.stock}
                        aria-label={`Aumentar cantidad de ${product.name}`}
                        className="rx-quantity-button"
                      >
                        <MaterialIcon name="add" className="text-lg" />
                      </button>
                    </div>

                    <strong className="rx-cart-item-total">
                      {fmt(product.price * item.quantity)}
                    </strong>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <footer className="rx-cart-summary">
        <div className="rx-summary-list">
          <div className="rx-summary-row">
            <span>Subtotal</span>
            <strong>{fmt(subtotal)}</strong>
          </div>
          <div className="rx-summary-row">
            <span>Descuento</span>
            <strong>{fmt(discount)}</strong>
          </div>
          <div className="rx-summary-row rx-summary-total">
            <span className="rx-summary-total-label">Total</span>
            <strong className="rx-summary-total-value">{fmt(total)}</strong>
          </div>
        </div>

        <button
          type="button"
          onClick={onCobrar}
          disabled={cart.length === 0}
          className="rx-btn rx-btn--dark rx-btn--large rx-btn--block"
        >
          <MaterialIcon name="payments" className="text-xl" />
          Cobrar
        </button>

        {cart.length > 0 && (
          <button
            type="button"
            onClick={onCancelVenta}
            className="rx-btn rx-btn--danger-ghost rx-btn--block mt-2"
          >
            Cancelar venta
          </button>
        )}
      </footer>
    </aside>
  )
}
