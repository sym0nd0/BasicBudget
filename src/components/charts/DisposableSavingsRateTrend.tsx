import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { formatCurrency, formatYearMonth } from '../../utils/formatters';
import type { MonthlyReportRow } from '../../types';

interface DisposableSavingsRateTrendProps {
  data: MonthlyReportRow[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-[var(--color-text)] mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.name === 'Savings Rate' ? `${entry.value.toFixed(1)}%` : formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
};

export function DisposableSavingsRateTrend({ data }: DisposableSavingsRateTrendProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)] text-sm">
        No data available
      </div>
    );
  }

  // Calculate savings rate: (income - expenses - debt - savings) / income * 100
  // Actually, savings rate should be: savings / income * 100
  const chartData = data.map(row => {
    const savingsRate = row.income_pence > 0 ? (row.savings_pence / row.income_pence) * 100 : 0;
    return {
      month: formatYearMonth(row.month),
      'Disposable Income': row.disposable_pence,
      'Savings Rate': savingsRate,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="month"
          tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
        />
        {/* Left Y-axis: Disposable Income in GBP */}
        <YAxis
          yAxisId="left"
          tickFormatter={v => `£${(v / 100000).toFixed(1)}k`}
          tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
          label={{ value: 'Disposable (£)', angle: -90, position: 'insideLeft' }}
        />
        {/* Right Y-axis: Savings Rate in % */}
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={v => `${v.toFixed(0)}%`}
          tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
          label={{ value: 'Savings Rate (%)', angle: 90, position: 'insideRight' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => (
            <span style={{ color: 'var(--color-text)', fontSize: 11 }}>{value}</span>
          )}
        />
        {/* Zero line on left axis */}
        <ReferenceLine yAxisId="left" y={0} stroke="var(--color-border)" strokeDasharray="3 3" />
        {/* Disposable income line */}
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="Disposable Income"
          stroke="var(--color-chart-1)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5 }}
          name="Disposable Income"
        />
        {/* Savings rate line */}
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="Savings Rate"
          stroke="var(--color-chart-2)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5 }}
          name="Savings Rate"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
