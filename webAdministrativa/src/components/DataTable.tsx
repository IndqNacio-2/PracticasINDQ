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

const pageBtn = 'px-3 py-1 rounded-full border-[1.5px] text-[13px] font-semibold transition-colors';

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
        <div className="relative max-w-md">
          <Icon
            name="search"
            size={18}
            weight={500}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--ink3)] pointer-events-none"
          />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 text-sm text-[color:var(--ink)] border-[1.5px] border-[#CFCCC4] rounded-2xl bg-[color:var(--soft)] placeholder:text-[color:var(--ink3)] focus:outline-none focus:border-[color:var(--ink)] focus:bg-white transition-colors"
          />
        </div>
      )}

      {paginated.length === 0 ? (
        <div className="rounded-2xl border-[1.5px] border-[color:var(--line)] bg-white py-12 text-center text-[color:var(--ink3)]">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* Cada fila es una tarjeta redondeada (estilos en theme.css) */}
          <table className="rowtable text-sm">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} className={`text-left ${col.className ?? ''}`}>{col.header}</th>
                ))}
                {actions && <th className="text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {paginated.map((row, i) => (
                <tr key={i}>
                  {columns.map(col => (
                    <td key={col.key} className={`py-3.5 text-[color:var(--ink)] ${col.className ?? ''}`}>
                      {col.render ? col.render(row) : String(row[col.key] ?? '-')}
                    </td>
                  ))}
                  {actions && <td className="py-3.5 text-right">{actions(row)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-[color:var(--ink2)]">
          <span>{filtered.length} registros · Página {page} de {totalPages}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Página anterior"
              className={`flex items-center ${pageBtn} border-[color:var(--line)] bg-white hover:border-[color:var(--ink3)] disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Icon name="chevron_left" size={18} weight={500} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`${pageBtn} ${p === page
                    ? 'bg-[color:var(--dark)] text-white border-[color:var(--dark)]'
                    : 'bg-white text-[color:var(--ink)] border-[color:var(--line)] hover:border-[color:var(--ink3)]'}`}>
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Página siguiente"
              className={`flex items-center ${pageBtn} border-[color:var(--line)] bg-white hover:border-[color:var(--ink3)] disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Icon name="chevron_right" size={18} weight={500} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
