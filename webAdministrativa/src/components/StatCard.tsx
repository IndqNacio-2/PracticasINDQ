interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  accent?: string;
}

export function StatCard({ label, value, icon, trend, accent = '#2E9E5B' }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[color:var(--line)] hover:border-[#D3D0C8] transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] text-[color:var(--ink2)] font-medium">{label}</p>
          <p className="text-2xl font-extrabold tracking-tight text-[color:var(--ink)] mt-1">{value}</p>
          {trend && (
            <p className={`text-xs mt-1.5 font-semibold ${trend.positive ? 'text-[color:var(--ok)]' : 'text-[color:var(--bad)]'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value} vs. mes anterior
            </p>
          )}
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${accent}1F` }}>
          <div style={{ color: accent }}>{icon}</div>
        </div>
      </div>
    </div>
  );
}
