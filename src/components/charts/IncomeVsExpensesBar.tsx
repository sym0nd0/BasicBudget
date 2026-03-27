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
import { formatCurrency } from '../../utils/formatters';

interface IncomeVsExpensesBarProps {
  income: number;
  expenses: number;
  debtPayments: number;
  savings: number;
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

export function IncomeVsExpensesBar({ income, expenses, debtPayments, savings }: IncomeVsExpensesBarProps) {
  const data = [
    {
      name: 'This Month',
      Income: income,
      Expenses: expenses,
      'Debt Payments': debtPayments,
      Savings: savings,
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="name" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} />
        <YAxis
          tickFormatter={v => `£${(v / 100000).toFixed(1)}k`}
          tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} cursor={false} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Income" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Expenses" fill="var(--color-chart-5)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Debt Payments" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Savings" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
