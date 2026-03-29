import { useFilter } from '../context/FilterContext';
import { useApi } from './useApi';
import { addMonthsToYM, previousRange } from '../utils/reportRanges';
import type { MonthlyReportRow } from '../types';

interface UsePreviousPeriodOptions {
  readonly householdOnly?: boolean;
}

interface PreviousPeriodTotals {
  readonly income: number;
  readonly expenses: number;
  readonly debt: number;
  readonly savings: number;
  readonly disposable: number;
}

export function usePreviousPeriod(
  options?: UsePreviousPeriodOptions,
): PreviousPeriodTotals | null {
  const { activeMonth, fromMonth, toMonth, isRangeActive, rangePreset } = useFilter();
  const suffix = options?.householdOnly ? '&household_only=true' : '';

  const prevRange = isRangeActive
    ? previousRange(rangePreset, fromMonth, toMonth)
    : { from: addMonthsToYM(activeMonth, -1), to: addMonthsToYM(activeMonth, -1) };

  const url = `/reports/overview?from=${prevRange.from}&to=${prevRange.to}${suffix}`;
  const { data } = useApi<MonthlyReportRow[]>(url);

  if (!data) return null;

  return {
    income: data.reduce((s, r) => s + r.income_pence, 0),
    expenses: data.reduce((s, r) => s + r.expenses_pence, 0),
    debt: data.reduce((s, r) => s + r.debt_payments_pence, 0),
    savings: data.reduce((s, r) => s + r.savings_pence, 0),
    disposable: data.reduce((s, r) => s + r.disposable_pence, 0),
  };
}
