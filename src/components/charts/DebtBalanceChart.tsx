import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useApi } from '../../hooks/useApi';
import { Card, CardHeader } from '../ui/Card';
import { TimeRangeSelector } from '../ui/TimeRangeSelector';
import { formatCurrency, formatYearMonth } from '../../utils/formatters';
import type { ReportRange, DebtProjectionPoint } from '../../types';

interface DebtBalanceChartProps {
  range?: ReportRange;
  householdOnly?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg p-3 text-sm max-w-xs">
      <p className="font-semibold text-[var(--color-text)] mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }} className="text-xs">
          {entry.name}: {formatCurrency(entry.value as number)}
        </p>
      ))}
    </div>
  );
};

export function DebtBalanceChart({ range: externalRange, householdOnly }: DebtBalanceChartProps) {
  const [internalRange, setInternalRange] = useState<ReportRange>('1y');
  const range = externalRange ?? internalRange;
  const isControlled = externalRange !== undefined;

  // Resolve range to month count
  const getMonthCount = (r: ReportRange): number => {
    switch (r) {
      case '1w': return 2;   // ±1 month shown as 2 months
      case '1m': return 2;
      case '3m': return 3;
      case 'ytd': return 12;
      case '2y': return 24;
      case '5y': return 60;
      case 'all': return 120;
      case '1y':
      default: return 12;
    }
  };

  const { data } = useApi<DebtProjectionPoint[]>(`/reports/debt-projection?months=${getMonthCount(range)}${householdOnly ? '&household_only=true' : ''}`);

  const safeData = data ?? [];

  // Format data for chart, including per-debt balances
  const chartData = safeData.map(point => {
    const row: any = {
      display_month: formatYearMonth(point.month),
      'Total Debt': point.total_balance_pence,
    };
    // Add per-debt balances as separate keys
    for (const debt of point.per_debt) {
      row[debt.name] = debt.balance_pence;
    }
    return row;
  });

  // Get unique debt names for legend (in order of first appearance)
  const debtNames: string[] = [];
  const seenDebtNames = new Set<string>();
  for (const point of safeData) {
    for (const debt of point.per_debt) {
      if (!seenDebtNames.has(debt.name)) {
        debtNames.push(debt.name);
        seenDebtNames.add(debt.name);
      }
    }
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader title="Debt Balance Projection" subtitle="Projected balance over time" />
        <p className="text-sm text-[var(--color-text-muted)] p-4">No debt data available</p>
      </Card>
    );
  }

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

  return (
    <Card>
      <div className="px-5 pt-5">
        <CardHeader title="Debt Balance Projection" subtitle="Projected debt balance over time" />
        {!isControlled && (
          <div className="mt-4">
            <TimeRangeSelector value={range} onChange={setInternalRange} />
          </div>
        )}
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
          <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 20 }} />
          {/* Total debt line (thick) */}
          <Line
            type="monotone"
            dataKey="Total Debt"
            stroke={COLORS[0]}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5 }}
            name="Total Debt"
          />
          {/* Per-debt lines (thin) */}
          {debtNames.map((name, idx) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={COLORS[(idx + 1) % COLORS.length]}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 5 }}
              name={name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}


