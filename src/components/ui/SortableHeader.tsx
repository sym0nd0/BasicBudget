interface SortableHeaderProps {
  label: string;
  sortKey: string;
  activeSortKey: string | null;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  className?: string;
}

export function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  sortDir,
  onSort,
  className = '',
}: SortableHeaderProps) {
  const isSorted = activeSortKey === sortKey;

  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer select-none hover:bg-[var(--color-surface-2)] transition-colors px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide text-center ${className}`}
    >
      <div className="flex items-center gap-2">
        <span>{label}</span>
        {isSorted && (
          <svg
            className={`w-4 h-4 transition-transform ${sortDir === 'desc' ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4" />
          </svg>
        )}
      </div>
    </th>
  );
}
