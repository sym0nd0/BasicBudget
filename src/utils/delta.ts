/**
 * Calculates the absolute and percentage change between two values.
 * Extracted from ReportsPage for reuse across all tabs.
 *
 * Returns `null` for `percentage` when `previous` is zero and `current` is
 * non-zero — the percentage is mathematically undefined in that case.
 */
export function calculateDelta(
  current: number,
  previous: number,
): { delta: number; percentage: number | null } {
  const delta = current - previous;
  let percentage: number | null;
  if (previous !== 0) {
    percentage = (delta / previous) * 100;
  } else if (delta !== 0) {
    percentage = null;
  } else {
    percentage = 0;
  }
  return { delta, percentage };
}
