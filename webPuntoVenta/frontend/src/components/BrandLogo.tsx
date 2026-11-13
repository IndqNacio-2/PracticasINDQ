interface BrandLogoProps {
  variant?: "full" | "symbol"
  className?: string
}

/** Marca blanca transparente que se integra con el fondo de cada sección. */
export default function BrandLogo({ variant = "full", className = "" }: BrandLogoProps) {
  const symbol = variant === "symbol"
  return (
    <img
      src={symbol ? "/branding/nuucleo-symbol.png" : "/branding/nuucleo-logo.png"}
      alt={symbol ? "NUUCLEO" : "NUUCLEO — Hybrid Training Club"}
      width={symbol ? 453 : 1507}
      height={322}
      draggable={false}
      className={`rx-brand-image ${symbol ? "rx-brand-image--symbol" : "rx-brand-image--full"} block h-auto max-w-full object-contain ${className}`}
    />
  )
}