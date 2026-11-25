import { useEffect, useState, ReactNode } from 'react';
import { Icon } from './Icon';
import { normalizarNombre } from '../../../services/busquedaClientes';

interface Column<T> {
  key: string;
  header: ReactNode;
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
  normalizeSearch?: boolean;
}

export function DataTable<T extends Record<string, unknown>>({
  columns, data, searchKeys = [], pageSize = 10, emptyMessage = 'Sin registros', actions, variant = 'default', searchPlaceholder = 'Buscar...', normalizeSearch = false
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = search
    ? data.filter(row =>
      searchKeys.some(k => normalizeSearch ? normalizarNombre(row[k]).includes(normalizarNombre(search)) : String(row[k] ?? '').toLowerCase().includes(search.toLowerCase()))
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
            className="absolute left-[14px] top-1/2 -translate-y-1/2 text-[color:var(--rx-ink-muted)] pointer-events-none"
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            aria-label="Buscar registros"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="rx-input pl-[42px] pr-10"
          />
        </div>
      )}

      <div className={styled ? 'rx-data-list-scroll' : 'overflow-x-auto rounded-[var(--rx-radius-medium)] border border-[var(--rx-line)] bg-[var(--rx-surface)]'} tabIndex={styled ? 0 : undefined} role={styled ? 'region' : undefined} aria-label={styled ? 'Listado de registros' : undefined}>
        <table className="rx-table">
          <thead>
            <tr className={styled ? '' : 'border-b border-[var(--rx-line)] bg-[var(--rx-surface-soft)]'}>
              {columns.map(col => (
                <th scope="col" key={col.key} className={`px-4 py-3 text-left text-[length:var(--rx-table-heading-size)] font-extrabold text-[color:var(--rx-ink-secondary)] uppercase tracking-[0.06em] ${col.className ?? ''}`}>
                  {col.header}
                </th>
              ))}
              {actions && <th scope="col" className="px-4 py-3 text-right text-[length:var(--rx-table-heading-size)] font-extrabold text-[color:var(--rx-ink-secondary)] uppercase tracking-[0.06em]">Acciones</th>}
            </tr>
          </thead>
          <tbody className={styled ? '' : 'divide-y divide-[var(--rx-line)]'}>
            {paginated.length === 0 ? (
              <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-12 text-center text-[color:var(--rx-ink-muted)]">{emptyMessage}</td></tr>
            ) : paginated.map((row, i) => (
              <tr key={i} className={styled ? '' : 'hover:bg-[var(--rx-surface-soft)] transition-colors'}>
                {columns.map(col => (
                  <td key={col.key} className={`px-4 py-3.5 text-[color:var(--rx-ink-secondary)] ${col.className ?? ''}`}>
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
        <div className="flex items-center justify-between text-sm text-[color:var(--rx-ink-secondary)]">
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