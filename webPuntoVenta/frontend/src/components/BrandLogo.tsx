interface BrandLogoProps {
  variant?: "full" | "symbol"
  className?: string
}

/** Originales blancos de NUUCLEO: usar siempre sobre una superficie oscura. */
export default function BrandLogo({ variant = "full", className = "" }: BrandLogoProps) {
  const symbol = variant === "symbol"
  return (
    <img
      src={symbol ? "/branding/nuucleo-symbol.png" : "/branding/nuucleo-logo.png"}
      alt={symbol ? "NUUCLEO" : "NUUCLEO — Hybrid Training Club"}
      width={symbol ? 453 : 1507}
      height={322}
      draggable={false}
      className={`block h-auto max-w-full object-contain ${className}`}
    />
  )
}