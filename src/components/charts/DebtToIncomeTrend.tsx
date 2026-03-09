import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { formatYearMonth } from '../../utils/formatters';
import type { MonthlyReportRow } from '../../types';

interface DebtToIncomeTrendProps {
  data: MonthlyReportRow[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-[var(--color-text)] mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value.toFixed(1)}%
        </p>
      ))}
    </div>
  );
};

export function DebtToIncomeTrend({ data }: DebtToIncomeTrendProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)] text-sm">
        No data available
      </div>
    );
  }

  // Calculate DTI: debt_payments / income * 100
  const chartData = data.map(row => {
    const dti = row.income_pence > 0 ? (row.debt_payments_pence / row.income_pence) * 100 : 0;
    return {
      month: formatYearMonth(row.month),
      'DTI Ratio': dti,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="month"
          tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
        />
        <YAxis
          tickFormatter={v => `${v.toFixed(0)}%`}
          tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => (
            <span style={{ color: 'var(--color-text)', fontSize: 11 }}>{value}</span>
          )}
        />
        {/* 35% threshold line — recommended healthy DTI */}
        <ReferenceLine
          y={35}
          stroke="var(--color-warning)"
          strokeDasharray="5 5"
          label={{
            value: '35% Threshold',
            position: 'right',
            fill: 'var(--color-warning)',
            fontSize: 11,
          }}
        />
        {/* DTI line */}
        <Line
          type="monotone"
          dataKey="DTI Ratio"
          stroke="var(--color-chart-4)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5 }}
          name="DTI Ratio"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
