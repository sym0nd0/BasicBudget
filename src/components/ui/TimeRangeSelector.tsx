import type { ReportRange } from '../../types';

const RANGES: { label: string; value: ReportRange }[] = [
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: 'YTD', value: 'ytd' },
  { label: '1Y', value: '1y' },
  { label: '2Y', value: '2y' },
  { label: '5Y', value: '5y' },
];

interface TimeRangeSelectorProps {
  value: ReportRange;
  onChange: (range: ReportRange) => void;
  excludeRanges?: ReportRange[];
}

export function TimeRangeSelector({ value, onChange, excludeRanges }: TimeRangeSelectorProps) {
  return (
    <div className="flex gap-1 flex-wrap">
      {RANGES.filter(r => !excludeRanges?.includes(r.value)).map(r => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={[
            'px-2.5 py-1 rounded text-xs font-medium transition-colors',
            value === r.value
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
          ].join(' ')}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
