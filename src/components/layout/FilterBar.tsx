import { Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useFilter } from '../../context/FilterContext';
import { formatYearMonth } from '../../utils/formatters';
import { useApi } from '../../hooks/useApi';
import { EXPENSE_CATEGORIES } from '../../types';
import type { ReportRange } from '../../types';

function generateMonthOptions(count: number = 24): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -count / 2; i <= count / 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    options.push({ value, label: formatYearMonth(value) });
  }
  return options;
}

const MONTH_OPTIONS = generateMonthOptions(24);

const PRESET_PILLS: { label: string; value: ReportRange }[] = [
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '12M', value: '12m' },
  { label: 'Custom', value: 'custom' },
];

interface FilterBarProps {
  showCategory?: boolean;
}

export function FilterBar({ showCategory = false }: FilterBarProps) {
  const {
    activeMonth, setActiveMonth,
    filterCategory, setFilterCategory,
    fromMonth, toMonth, setFromMonth, setToMonth,
    isRangeActive, rangeMonths,
    rangePreset, setRangePreset,
  } = useFilter();
  const { data: categoriesData } = useApi<string[]>(showCategory ? '/categories' : null);
  const categories = categoriesData ?? [...EXPENSE_CATEGORIES];
  const isDefault = filterCategory === 'all';

  const rangeLabel = isRangeActive
    ? `${formatYearMonth(fromMonth)} – ${formatYearMonth(toMonth)} (${rangeMonths.length} months)`
    : null;

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Preset pills */}
      <div className="flex gap-1 flex-wrap">
        {PRESET_PILLS.map(pill => (
          <button
            key={pill.value}
            onClick={() => setRangePreset(pill.value)}
            className={[
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              rangePreset === pill.value
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
            ].join(' ')}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* 1M: show month dropdown */}
      {rangePreset === '1m' && (
        <div className="min-w-40">
          <Select
            label="Month"
            value={activeMonth}
            onChange={e => setActiveMonth(e.target.value)}
            options={MONTH_OPTIONS}
          />
        </div>
      )}

      {/* 3M/6M/12M: show range badge */}
      {rangeLabel && rangePreset !== 'custom' && (
        <Badge variant="primary">{rangeLabel}</Badge>
      )}

      {/* Custom: show from/to inputs */}
      {rangePreset === 'custom' && (
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">From</label>
            <input
              type="month"
              value={fromMonth}
              onChange={e => setFromMonth(e.target.value || fromMonth)}
              className="text-sm border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-[var(--color-surface)] text-[var(--color-text)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">To</label>
            <input
              type="month"
              value={toMonth}
              onChange={e => setToMonth(e.target.value || toMonth)}
              className="text-sm border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-[var(--color-surface)] text-[var(--color-text)]"
            />
          </div>
          {rangeLabel && <Badge variant="primary">{rangeLabel}</Badge>}
        </div>
      )}

      {/* Category filter */}
      {showCategory && (
        <>
          <div className="min-w-40">
            <Select
              label="Category"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              options={[
                { value: 'all', label: 'All Categories' },
                ...categories.map(c => ({ value: c, label: c })),
              ]}
            />
          </div>
          {!isDefault && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterCategory('all')}
            >
              Clear
            </Button>
          )}
        </>
      )}
    </div>
  );
}
