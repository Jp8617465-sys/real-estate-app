'use client';

import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type SortDirection = 'asc' | 'desc';

interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

// ─── Table Skeleton ──────────────────────────────────────────────────────────

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr className="bg-gray-50">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: 5 }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx} className="px-4 py-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Data Table ──────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'No data available.',
  searchPlaceholder = 'Search...',
  onSearch,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey],
  );

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return data;

    const getValue = col.sortValue;
    return [...data].sort((a, b) => {
      const aVal = getValue(a);
      const bVal = getValue(b);
      const cmp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      setSearchQuery(q);
      onSearch?.(q);
    },
    [onSearch],
  );

  if (isLoading) {
    return <TableSkeleton columns={columns.length} />;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {onSearch && (
        <div className="flex items-center">
          <label htmlFor="data-table-search" className="sr-only">
            {searchPlaceholder}
          </label>
          <input
            id="data-table-search"
            type="search"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
            className="w-full max-w-sm rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200" role="table">
          <thead>
            <tr className="bg-gray-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.align !== 'right' && col.align !== 'center' && 'text-left',
                    col.sortable && 'cursor-pointer select-none hover:text-gray-700',
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <span aria-hidden="true">
                        {sortDir === 'asc' ? '\u2191' : '\u2193'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  className="transition-colors hover:bg-gray-50"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-sm',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type { Column };
