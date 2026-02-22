import { Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { useFilter } from '../../context/FilterContext';
import { formatYearMonth } from '../../utils/formatters';

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
  const { activeMonth, setActiveMonth, filterCategory, setFilterCategory } = useFilter();

  const isDefault = filterCategory === 'all';

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="min-w-40">
        <Select
          label="Month"
          value={activeMonth}
          onChange={e => setActiveMonth(e.target.value)}
          options={MONTH_OPTIONS}
        />
      </div>
      {showCategory && (
        <>
          <div className="min-w-40">
            <Select
              label="Category"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              options={[
                { value: 'all', label: 'All Categories' },
                { value: 'Housing', label: 'Housing' },
                { value: 'Transport', label: 'Transport' },
                { value: 'Food & Groceries', label: 'Food & Groceries' },
                { value: 'Utilities', label: 'Utilities' },
                { value: 'Subscriptions', label: 'Subscriptions' },
                { value: 'Personal', label: 'Personal' },
                { value: 'Health', label: 'Health' },
                { value: 'Entertainment', label: 'Entertainment' },
                { value: 'Debt Payments', label: 'Debt Payments' },
                { value: 'Savings', label: 'Savings' },
                { value: 'Other', label: 'Other' },
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
