/** Format a pence integer as GBP currency (divides by 100 internally) */
export const formatCurrency = (pence: number): string =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pence / 100);

/** Format a percentage (e.g. 37.7 → "37.70%") */
export const formatPercent = (value: number): string =>
  `${value.toFixed(2)}%`;

/** Format ordinal day of month (e.g. 1 → "1st", 22 → "22nd") */
export const formatOrdinal = (n: number): string => {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
};

/** Format months as "X yrs Y mo" or just "Y mo" */
export const formatMonths = (months: number): string => {
  if (months >= 12) {
    const yrs = Math.floor(months / 12);
    const mo = months % 12;
    return mo > 0 ? `${yrs} yr${yrs > 1 ? 's' : ''} ${mo} mo` : `${yrs} yr${yrs > 1 ? 's' : ''}`;
  }
  return `${months} mo`;
};

/** Format a date string "YYYY-MM" to "Jan 2026" */
export const formatYearMonth = (ym: string): string => {
  const [year, month] = ym.split('-').map(Number);
  return new Date(year, month - 1).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
};

/** Convert pounds string to pence integer for form submission */
export const poundsToPence = (pounds: string): number =>
  Math.round(parseFloat(pounds) * 100);

/** Convert pence integer to pounds string for form display */
export const penceToPoundsStr = (pence: number): string =>
  (pence / 100).toFixed(2);

type DateFormatPref = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

/** Format an ISO date/datetime string to a user-preferred date format.
 * Date-only strings ("YYYY-MM-DD") are parsed as local time to avoid UTC
 * day-shift (new Date("2026-03-24") is UTC midnight, causing off-by-one in
 * negative-offset timezones). Full ISO timestamps are parsed normally.
 * Defaults to DD/MM/YYYY (en-GB) when `prefs` is absent or null. */
export function formatDate(
  iso: string,
  prefs?: { date_format?: string | null } | null,
): string {
  const rawFmt = prefs?.date_format ?? 'DD/MM/YYYY';
  const fmt: DateFormatPref =
    rawFmt === 'MM/DD/YYYY' || rawFmt === 'YYYY-MM-DD' ? rawFmt : 'DD/MM/YYYY';

  // Detect date-only strings and parse as local time.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(iso);

  if (fmt === 'YYYY-MM-DD') {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const locale = fmt === 'MM/DD/YYYY' ? 'en-US' : 'en-GB';
  return d.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Format an ISO datetime string to a user-preferred date + time string.
 * Defaults to DD/MM/YYYY and 12h when `prefs` is absent or null. */
export function formatDateTime(
  iso: string,
  prefs?: { date_format?: string | null; time_format?: string | null } | null,
): string {
  const datePart = formatDate(iso, prefs);
  const hour12 = (prefs?.time_format ?? '12h') !== '24h';
  const timePart = new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12,
  });
  return `${datePart}, ${timePart}`;
}
