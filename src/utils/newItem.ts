interface NewItemSource {
  start_date?: string | null;
  created_at?: string;
}

function toYearMonth(value: string | null | undefined): string | null {
  if (!value || value.length < 7) return null;
  return value.slice(0, 7);
}

export function getFirstRelevantMonth(item: NewItemSource): string | null {
  return toYearMonth(item.start_date) ?? toYearMonth(item.created_at);
}

export function isNewInDisplayedMonth(item: NewItemSource, displayedMonth: string): boolean {
  return getFirstRelevantMonth(item) === displayedMonth;
}
