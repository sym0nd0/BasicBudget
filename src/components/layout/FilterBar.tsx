import { useState } from 'react';
import { Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { useFilter } from '../../context/FilterContext';
import { formatYearMonth } from '../../utils/formatters';
import { useApi } from '../../hooks/useApi';
import { EXPENSE_CATEGORIES } from '../../types';

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

interface FilterBarProps {
  showCategory?: boolean;
}

export function FilterBar({ showCategory = false }: FilterBarProps) {
  const {
    activeMonth, setActiveMonth,
    filterCategory, setFilterCategory,
    fromMonth, toMonth, setFromMonth, setToMonth,
    isRangeActive, rangeMonths, rangeIndex, setRangeIndex,
  } = useFilter();
  const { data: categoriesData } = useApi<string[]>(showCategory ? '/categories' : null);
  const categories = categoriesData ?? [...EXPENSE_CATEGORIES];
  const [showRange, setShowRange] = useState(false);

  const isDefault = filterCategory === 'all';

  const handleToggleRange = () => {
    if (showRange) {
      setFromMonth(null);
      setToMonth(null);
    }
    setShowRange(prev => !prev);
  };

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {!showRange || !isRangeActive ? (
        <div className="min-w-40">
          <Select
            label="Month"
            value={activeMonth}
            onChange={e => setActiveMonth(e.target.value)}
            options={MONTH_OPTIONS}
          />
        </div>
      ) : (
        <div className="flex items-end gap-1">
          <button
            onClick={() => setRangeIndex(Math.max(0, rangeIndex - 1))}
            disabled={rangeIndex === 0}
            className="mb-0.5 p-1.5 rounded hover:bg-[var(--color-surface-2)] disabled:opacity-30 text-[var(--color-text)]"
            aria-label="Previous month"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-sm font-medium text-[var(--color-text)] min-w-28 text-center leading-none">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">Month {rangeIndex + 1} of {rangeMonths.length}</div>
            <div>{formatYearMonth(activeMonth)}</div>
          </div>
          <button
            onClick={() => setRangeIndex(Math.min(rangeMonths.length - 1, rangeIndex + 1))}
            disabled={rangeIndex === rangeMonths.length - 1}
            className="mb-0.5 p-1.5 rounded hover:bg-[var(--color-surface-2)] disabled:opacity-30 text-[var(--color-text)]"
            aria-label="Next month"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      <Button
        variant={showRange ? 'secondary' : 'ghost'}
        size="sm"
        onClick={handleToggleRange}
        title="Toggle date range"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Range
      </Button>

      {showRange && (
        <>
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">From</label>
              <input
                type="month"
                value={fromMonth ?? ''}
                onChange={e => setFromMonth(e.target.value || null)}
                className="text-sm border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-[var(--color-surface)] text-[var(--color-text)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1">To</label>
              <input
                type="month"
                value={toMonth ?? ''}
                onChange={e => setToMonth(e.target.value || null)}
                className="text-sm border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-[var(--color-surface)] text-[var(--color-text)]"
              />
            </div>
          </div>
        </>
      )}

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
