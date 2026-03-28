/**
 * Calculates the absolute and percentage change between two values.
 * Extracted from ReportsPage for reuse across all tabs.
 */
export function calculateDelta(
  current: number,
  previous: number,
): { delta: number; percentage: number } {
  const delta = current - previous;
  const percentage = previous !== 0 ? (delta / previous) * 100 : 0;
  return { delta, percentage };
}
