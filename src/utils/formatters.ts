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
 * Defaults to DD/MM/YYYY (en-GB) when `prefs` is absent or null. */
export function formatDate(
  iso: string,
  prefs?: { date_format?: string | null } | null,
): string {
  const fmt = (prefs?.date_format ?? 'DD/MM/YYYY') as DateFormatPref;
  if (fmt === 'YYYY-MM-DD') return iso.slice(0, 10);
  const locale = fmt === 'MM/DD/YYYY' ? 'en-US' : 'en-GB';
  return new Date(iso).toLocaleDateString(locale, {
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
