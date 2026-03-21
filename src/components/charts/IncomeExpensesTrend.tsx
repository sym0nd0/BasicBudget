import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatYearMonth } from '../../utils/formatters';
import type { MonthlyReportRow } from '../../types';

interface IncomeExpensesTrendProps {
  data: MonthlyReportRow[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-[var(--color-text)] mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value as number)}
        </p>
      ))}
    </div>
  );
};

export function IncomeExpensesTrend({ data }: IncomeExpensesTrendProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)] text-sm">
        No data available
      </div>
    );
  }

  const chartData = data.map(row => ({
    month: formatYearMonth(row.month),
    Income: row.income_pence,
    Expenses: row.expenses_pence,
    'Debt Payments': row.debt_payments_pence,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="month"
          tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
        />
        <YAxis
          tickFormatter={v => `£${(v / 100000).toFixed(1)}k`}
          tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
        />
        <Tooltip content={<CustomTooltip />} cursor={false} />
        <Legend
          formatter={(value) => (
            <span style={{ color: 'var(--color-text)', fontSize: 11 }}>{value}</span>
          )}
        />
        <Bar dataKey="Income" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Expenses" fill="var(--color-chart-5)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Debt Payments" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

