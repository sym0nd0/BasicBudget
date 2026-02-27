import type { SortDir } from '../../hooks/useSortableTable';

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  activeSortKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableHeader({ label, sortKey, activeSortKey, sortDir, onSort, className = '' }: SortableHeaderProps) {
  const isActive = activeSortKey === sortKey;
  return (
    <th
      className={`cursor-pointer select-none px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide hover:text-[var(--color-text)] transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
          {isActive ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  );
}
