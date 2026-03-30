import { calculateDelta } from '../../utils/delta';
import { formatCurrency, formatPercent } from '../../utils/formatters';

interface DeltaIndicatorProps {
  current: number;
  previous: number | null | undefined;
  /**
   * Controls colour semantics.
   * 'positive-up'   = increase is good (income, savings, disposable) — green for ↑
   * 'positive-down' = decrease is good (expenses, debt payments) — green for ↓
   * Defaults to 'positive-up'.
   */
  semantics?: 'positive-up' | 'positive-down';
}

/**
 * Renders a two-line coloured indicator showing change vs previous period:
 *   line 1: ↑ £X.XX  (arrow + absolute change)
 *   line 2: Y.YY%     (percentage change — omitted when previous was zero)
 * Returns null when there is no previous data or when the delta is exactly zero.
 */
export function DeltaIndicator({ current, previous, semantics = 'positive-up' }: DeltaIndicatorProps) {
  if (previous == null) return null;

  const { delta, percentage } = calculateDelta(current, previous);

  if (delta === 0) return null;

  const isIncrease = delta > 0;
  const isGood = semantics === 'positive-up' ? isIncrease : !isIncrease;
  const colourClass = isGood
    ? 'text-[var(--color-success)]'
    : 'text-[var(--color-danger)]';

  return (
    <div className={`text-xs mt-2 ${colourClass}`}>
      <div>{isIncrease ? '↑' : '↓'} {formatCurrency(Math.abs(delta))}</div>
      {percentage !== null && <div>{formatPercent(Math.abs(percentage))}</div>}
    </div>
  );
}
