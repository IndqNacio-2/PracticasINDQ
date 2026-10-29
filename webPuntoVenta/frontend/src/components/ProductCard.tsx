import type { Product } from "../types"

import MaterialIcon from "./MaterialIcon"

const fmt = (value: number) => `$${value.toFixed(2)}`

interface ProductCardProps {
  product: Product

  cartQty: number

  onAdd: () => void
}

export default function ProductCard({
  product,

  cartQty,

  onAdd,
}: ProductCardProps) {
  /* Considero agotado el producto cuando ya no tiene unidades disponibles. */

  const isOut = product.stock === 0

  /* Muestro una advertencia al alcanzar el mínimo configurado. */

  const isLow = product.stock > 0 && product.stock <= product.minimumStock

  /* Evito agregar más unidades que las disponibles en inventario. */

  const atMax = cartQty >= product.stock && !isOut

  const stockClassName = isOut
    ? "rx-product-stock rx-product-stock--danger"
    : isLow
      ? "rx-product-stock rx-product-stock--warning"
      : "rx-product-stock"

  return (
    <article
      className={`rx-product-card ${isOut ? "rx-product-card--disabled" : ""}`}
    >
      {/* Mantengo este color inline porque viene de los datos del producto. */}
      <div
        className="rx-product-visual"
        style={{ backgroundColor: product.bgColor }}
      >
        <MaterialIcon
          name={product.icon}
          className="select-none text-5xl text-[#374151]"
          filled
        />

        {cartQty > 0 && (
          <span
            className="rx-product-quantity"
            aria-label={`${cartQty} unidades en el carrito`}
          >
            {cartQty}
          </span>
        )}

        {isOut && (
          <span className="rx-product-state rx-badge rx-badge--danger">
            Agotado
          </span>
        )}

        {isLow && !isOut && (
          <span className="rx-product-state rx-badge rx-badge--warning">
            Pocas existencias
          </span>
        )}
      </div>

      <div className="rx-product-content">
        <p className="rx-product-category">{product.category}</p>
        <h3 className="rx-product-name">{product.name}</h3>

        <div className="rx-product-info">
          <span className="rx-product-price">{fmt(product.price)}</span>
          <span className={stockClassName}>
            {isOut ? "Sin existencias" : `${product.stock} disp.`}
          </span>
        </div>

        <button
          type="button"
          onClick={onAdd}
          disabled={isOut || atMax}
          className={`rx-btn rx-btn--block ${
            isOut || atMax ? "rx-btn--outline" : "rx-btn--accent"
          }`}
        >
          {isOut ? "Agotado" : atMax ? "Máximo alcanzado" : "Agregar"}
        </button>
      </div>
    </article>
  )
}
