import type { CSSProperties } from "react";

interface MaterialIconProps {
  name: string;
  className?: string;
  filled?: boolean;
}

export default function MaterialIcon({
  name,
  className = "",
  filled = false,
}: MaterialIconProps) {
  const iconStyle: CSSProperties = {
    fontVariationSettings: `"FILL" ${filled ? 1 : 0}, "wght" 500, "GRAD" 0, "opsz" 24`,
  };

  return (
    <span
      className={`material-symbols-rounded ${className}`}
      style={iconStyle}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}