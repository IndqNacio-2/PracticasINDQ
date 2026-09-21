interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  accent?: string;
}

export function StatCard({ label, value, icon, trend, accent = '#10b981' }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>{value}</p>
          {trend && (
            <p className={`text-xs mt-1.5 font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value} vs. mes anterior
            </p>
          )}
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${accent}18` }}>
          <div style={{ color: accent }}>{icon}</div>
        </div>
      </div>
    </div>
  );
}
