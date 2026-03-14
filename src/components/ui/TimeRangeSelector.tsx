import type { ReportRange } from '../../types';

const BASE_RANGES: { label: string; value: ReportRange }[] = [
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '12M', value: '12m' },
];

interface TimeRangeSelectorProps {
  value: ReportRange;
  onChange: (range: ReportRange) => void;
  excludeRanges?: ReportRange[];
  showCustom?: boolean;
}

export function TimeRangeSelector({ value, onChange, excludeRanges, showCustom }: TimeRangeSelectorProps) {
  const ranges = showCustom
    ? [...BASE_RANGES, { label: 'Custom', value: 'custom' as ReportRange }]
    : BASE_RANGES;
  return (
    <div className="flex gap-1 flex-wrap">
      {ranges.filter(r => !excludeRanges?.includes(r.value)).map(r => (
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
