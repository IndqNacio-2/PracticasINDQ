interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  accent?: string;
}

export function StatCard({ label, value, icon, trend, accent = "var(--rx-ink-secondary)" }: StatCardProps) {
  return (
    <div className="bg-[var(--rx-surface)] rounded-[var(--rx-radius-extra-large)] p-4 border-[1.5px] border-[var(--rx-line)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[color:var(--rx-ink-secondary)] font-medium">{label}</p>
          <p className="text-2xl font-bold text-[color:var(--rx-ink)] mr-1" style={{ fontFamily: 'var(--rx-font)' }}>{value}</p>
          {trend && (
            <p className={`text-xs mr-1.5 font-medium ${trend.positive ? "text-[color:var(--rx-success)]" : "text-[color:var(--rx-danger)]"}`}>
              {trend.positive ? "↑" : "↓"} {trend.value} vs. mes anterior
            </p>
          )}
        </div>
        <div className="w-11 h-11 rounded-[var(--rx-radius-medium)] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${accent} 12%, var(--rx-surface))` }}>
          <div style={{ color: accent }}>{icon}</div>
        </div>
      </div>
    </div>
  );
}