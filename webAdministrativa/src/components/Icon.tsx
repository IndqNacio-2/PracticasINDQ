interface IconProps {
    name: string;
    size?: number;
    filled?: boolean;
    weight?: number;
    className?: string;
}

export function Icon({ name, size = 24, filled = false, weight = 600, className = '' }: IconProps) {
    return (
        <span
            className={`material-symbols-rounded select-none leading-none ${className}`}
            style={{
                fontSize: size,
                fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${Math.min(Math.max(size, 20), 48)}`,
            }}
            aria-hidden="true"
        >
            {name}
        </span>
    );
}