import { useState, ReactNode } from 'react';
import { Icon } from './Icon';

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchKeys?: (keyof T)[];
  pageSize?: number;
  emptyMessage?: string;
  actions?: (row: T) => ReactNode;
}

export function DataTable<T extends Record<string, unknown>>({
  columns, data, searchKeys = [], pageSize = 10, emptyMessage = 'Sin registros', actions
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = search
    ? data.filter(row =>
      searchKeys.some(k => String(row[k] ?? '').toLowerCase().includes(search.toLowerCase()))
    )
    : data;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-3">
      {searchKeys.length > 0 && (
        <div className="relative">
          <Icon
            name="search"
            size={18}
            weight={500}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {columns.map(col => (
                <th key={col.key} className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide ${col.className ?? ''}`}>
                  {col.header}
                </th>
              ))}
              {actions && <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {paginated.length === 0 ? (
              <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-12 text-center text-slate-400">{emptyMessage}</td></tr>
            ) : paginated.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                {columns.map(col => (
                  <td key={col.key} className={`px-4 py-3.5 text-slate-700 ${col.className ?? ''}`}>
                    {col.render ? col.render(row) : String(row[col.key] ?? '-')}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3.5 text-right">{actions(row)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{filtered.length} registros · Página {page} de {totalPages}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Página anterior"
              className="flex items-center px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="chevron_left" size={18} weight={500} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded-lg border transition-colors ${p === page ? 'bg-emerald-500 text-white border-emerald-500' : 'border-slate-200 hover:bg-slate-100'}`}>
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Página siguiente"
              className="flex items-center px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="chevron_right" size={18} weight={500} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}