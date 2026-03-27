import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useApi } from '../../hooks/useApi';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { formatCurrency, formatYearMonth } from '../../utils/formatters';
import type { DebtPayoffStrategyResult } from '../../types';

interface DebtPayoffTimelineChartProps {
  householdOnly?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg p-3 text-sm max-w-xs">
      <p className="font-semibold text-[var(--color-text)] mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="text-xs">
          {entry.name}: {typeof entry.value === 'number' && Number.isFinite(entry.value) ? formatCurrency(entry.value) : '-'}
        </p>
      ))}
    </div>
  );
};

const COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
  'var(--color-chart-8)',
];

export function DebtPayoffTimelineChart({ householdOnly }: DebtPayoffTimelineChartProps) {
  const [strategy, setStrategy] = useState<'snowball' | 'avalanche'>('avalanche');
  const [showBreakdown, setShowBreakdown] = useState(false);

  const { data } = useApi<DebtPayoffStrategyResult>(
    `/reports/debt-payoff-timeline?strategy=${strategy}${householdOnly ? '&household_only=true' : ''}`
  );

  if (!data || data.months.length === 0) {
    return (
      <Card>
        <CardHeader title="Debt Payoff Timeline" subtitle="Snowball vs Avalanche strategy projection" />
        <p className="text-sm text-[var(--color-text-muted)] p-4">No debt data available</p>
      </Card>
    );
  }

  const chartData = data.months.map(point => {
    const row: Record<string, string | number> = {
      display_month: formatYearMonth(point.month),
      'Total Debt': point.total_balance_pence,
    };
    for (const debt of point.per_debt) {
      row[debt.id] = debt.balance_pence;
    }
    return row;
  });

  const debtSeries: { id: string; name: string }[] = [];
  const seenIds = new Set<string>();
  for (const point of data.months) {
    for (const debt of point.per_debt) {
      if (!seenIds.has(debt.id)) {
        debtSeries.push({ id: debt.id, name: debt.name });
        seenIds.add(debt.id);
      }
    }
  }

  const payoffDisplayMonth = data.total_payoff_date ? formatYearMonth(data.total_payoff_date) : null;

  return (
    <Card>
      <div className="px-5 pt-5">
        <CardHeader title="Debt Payoff Timeline" subtitle="Projected payoff using your monthly debt budget" />
        <div className="mt-4 flex gap-2">
          <Button
            variant={strategy === 'avalanche' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setStrategy('avalanche')}
            title="Avalanche: pay off highest interest rate first — minimises total interest paid"
          >
            Avalanche
          </Button>
          <Button
            variant={strategy === 'snowball' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setStrategy('snowball')}
            title="Snowball: pay off smallest balance first — builds momentum with quick wins"
          >
            Snowball
          </Button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="display_month"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
          />
          <YAxis
            tickFormatter={v => `£${(v / 100000).toFixed(1)}k`}
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
          />
          <Legend
            formatter={(value) => (
              <span style={{ color: 'var(--color-text)', fontSize: 11 }}>{value}</span>
            )}
          />
          <Tooltip content={<CustomTooltip />} cursor={false} wrapperStyle={{ zIndex: 20 }} />
          {payoffDisplayMonth && (
            <ReferenceLine
              x={payoffDisplayMonth}
              stroke="var(--color-success)"
              strokeDasharray="4 2"
              label={{ value: 'Paid off', position: 'insideTopLeft', fill: 'var(--color-success)', fontSize: 11 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="Total Debt"
            stroke={COLORS[0]}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5 }}
            name="Total Debt"
          />
          {debtSeries.map((series, idx) => (
            <Line
              key={series.id}
              type="monotone"
              dataKey={series.id}
              stroke={COLORS[(idx + 1) % COLORS.length]}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 5 }}
              name={series.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="px-5 pb-5">
        <button
          onClick={() => setShowBreakdown(prev => !prev)}
          aria-expanded={showBreakdown}
          aria-controls="breakdown-panel"
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline cursor-pointer"
        >
          {showBreakdown ? 'Hide breakdown' : 'Show breakdown'}
        </button>
        {showBreakdown && (
          <div id="breakdown-panel" role="region" aria-label="Monthly breakdown" className="mt-3 max-h-64 overflow-y-auto border border-[var(--color-border)] rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
                  <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">Month</th>
                  {debtSeries.map(series => (
                    <th key={series.id} className="text-right px-3 py-2 font-semibold text-[var(--color-text-muted)]">{series.name}</th>
                  ))}
                  <th className="text-right px-3 py-2 font-semibold text-[var(--color-text-muted)]">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((point, idx) => (
                  <tr key={idx} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]">
                    <td className="px-3 py-1.5 text-[var(--color-text)]">{formatYearMonth(point.month)}</td>
                    {debtSeries.map(series => {
                      const debt = point.per_debt.find(d => d.id === series.id);
                      return (
                        <td key={series.id} className="text-right px-3 py-1.5 font-mono text-[var(--color-text)]">
                          {formatCurrency(debt?.balance_pence ?? 0)}
                        </td>
                      );
                    })}
                    <td className="text-right px-3 py-1.5 font-mono font-semibold text-[var(--color-text)]">
                      {formatCurrency(point.total_balance_pence)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
