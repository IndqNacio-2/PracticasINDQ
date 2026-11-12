import { useEffect, useState, ReactNode } from 'react';
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
  variant?: 'default' | 'spaced' | 'panel';
  searchPlaceholder?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns, data, searchKeys = [], pageSize = 10, emptyMessage = 'Sin registros', actions, variant = 'default', searchPlaceholder = 'Buscar...'
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = search
    ? data.filter(row =>
      searchKeys.some(k => String(row[k] ?? '').toLowerCase().includes(search.toLowerCase()))
    )
    : data;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  // Al borrar el último registro de una página, pasar a la última válida,
  // sin reiniciar a la primera ni borrar la búsqueda.
  useEffect(() => { setPage(p => Math.min(p, totalPages)); }, [totalPages]);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const styled = variant !== 'default';

  return (
    <div className={`${variant === 'panel' ? '' : 'space-y-3'} ${styled ? 'rx-data-list' : ''} ${variant === 'panel' ? 'rx-data-list--panel' : ''}`}>
      {searchKeys.length > 0 && (
        <div className="relative">
          <Icon
            name="search"
            size={18}
            weight={500}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            aria-label="Buscar registros"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#111827] focus:border-transparent"
          />
        </div>
      )}

      <div className={styled ? 'rx-data-list-scroll' : 'overflow-x-auto rounded-xl border border-gray-100 bg-white'} tabIndex={styled ? 0 : undefined} role={styled ? 'region' : undefined} aria-label={styled ? 'Listado de registros' : undefined}>
        <table className="w-full text-sm">
          <thead>
            <tr className={styled ? '' : 'border-b border-gray-100 bg-gray-50'}>
              {columns.map(col => (
                <th scope="col" key={col.key} className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${col.className ?? ''}`}>
                  {col.header}
                </th>
              ))}
              {actions && <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>}
            </tr>
          </thead>
          <tbody className={styled ? '' : 'divide-y divide-gray-50'}>
            {paginated.length === 0 ? (
              <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-12 text-center text-gray-400">{emptyMessage}</td></tr>
            ) : paginated.map((row, i) => (
              <tr key={i} className={styled ? '' : 'hover:bg-gray-50/60 transition-colors'}>
                {columns.map(col => (
                  <td key={col.key} className={`px-4 py-3.5 text-gray-700 ${col.className ?? ''}`}>
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

      {(totalPages > 1 || styled) && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{filtered.length} registros · Página {currentPage} de {totalPages}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              type="button"
              disabled={currentPage === 1}
              aria-label="Página anterior"
              className="rx-btn rx-btn--outline rx-btn--sm"
            >
              <Icon name="chevron_left" size={18} weight={500} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return (
                <button type="button" key={p} onClick={() => setPage(p)}
                  aria-current={p === currentPage ? 'page' : undefined}
                  className={`rx-tab ${p === currentPage ? 'rx-tab--active' : ''}`}>
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              type="button"
              disabled={currentPage === totalPages}
              aria-label="Página siguiente"
              className="rx-btn rx-btn--outline rx-btn--sm"
            >
              <Icon name="chevron_right" size={18} weight={500} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}