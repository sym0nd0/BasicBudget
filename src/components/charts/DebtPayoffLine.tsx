import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { buildDebtPayoffChartData } from '../../utils/calculations';
import type { DebtPayoffSummary } from '../../types';
import { Card, CardHeader } from '../ui/Card';

interface DebtPayoffChartProps {
  summaries: DebtPayoffSummary[];
}

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
  'var(--color-chart-8)',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg p-3 text-sm max-w-xs">
      <p className="font-semibold text-[var(--color-text)] mb-1">Month {label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }} className="text-xs">
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
};

export function DebtPayoffChart({ summaries }: DebtPayoffChartProps) {
  const chartData = buildDebtPayoffChartData(summaries);
  const debtNames = summaries.map(s => s.debtName);

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Debt Payoff Projection"
        subtitle="Balances over time at current payment rates"
      />
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="month"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            label={{ value: 'Months', position: 'insideBottomRight', offset: -5, fontSize: 11, fill: 'var(--color-text-muted)' }}
          />
          <YAxis
            tickFormatter={v => `£${(v / 1000).toFixed(1)}k`}
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span style={{ color: 'var(--color-text)', fontSize: 11 }}>{value}</span>
            )}
          />
          {debtNames.map((name, idx) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={CHART_COLORS[idx % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
