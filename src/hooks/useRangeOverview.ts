import { useFilter } from '../context/FilterContext';
import { useApi } from './useApi';
import type { MonthlyReportRow } from '../types';

interface UseRangeOverviewOptions {
  householdOnly?: boolean;
}

export function useRangeOverview(options?: UseRangeOverviewOptions) {
  const { isRangeActive, fromMonth, toMonth } = useFilter();
  const suffix = options?.householdOnly ? '&household_only=true' : '';
  const url = isRangeActive && fromMonth && toMonth
    ? `/reports/overview?from=${fromMonth}&to=${toMonth}${suffix}`
    : null;
  const { data, loading } = useApi<MonthlyReportRow[]>(url);

  return { isRangeActive, data, loading };
}
