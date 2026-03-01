import { useState, useMemo } from 'react';

type SortDirection = 'asc' | 'desc';

export interface UseSortableTableOptions<T> {
  defaultSortKey?: keyof T;
}

export interface UseSortableTableResult<T> {
  sorted: T[];
  sortKey: keyof T | null;
  sortDir: SortDirection;
  toggleSort: (key: keyof T) => void;
}

export function useSortableTable<T extends Record<string, any>>(
  items: T[],
  defaultSortKey?: keyof T | UseSortableTableOptions<T>
): UseSortableTableResult<T> {
  const resolvedDefaultKey = typeof defaultSortKey === 'object'
    ? defaultSortKey?.defaultSortKey
    : defaultSortKey;

  const [sortKey, setSortKey] = useState<keyof T | null>(
    resolvedDefaultKey ?? null
  );
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const sorted = useMemo(() => {
    if (!sortKey) return items;

    const copy = [...items];
    copy.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === null || aVal === undefined) return sortDir === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return sortDir === 'asc' ? -1 : 1;

      let cmp = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }

      return sortDir === 'asc' ? cmp : -cmp;
    });

    return copy;
  }, [items, sortKey, sortDir]);

  const toggleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return { sorted, sortKey, sortDir, toggleSort };
}
