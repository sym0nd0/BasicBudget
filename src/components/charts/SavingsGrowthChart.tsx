import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatYearMonth } from '../../utils/formatters';
import type { SavingsTransaction } from '../../types';

interface SavingsGrowthChartProps {
  transactions: SavingsTransaction[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-[var(--color-text)] mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value as number)}
        </p>
      ))}
    </div>
  );
};

export function SavingsGrowthChart({ transactions }: SavingsGrowthChartProps) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--color-text-muted)] text-sm">
        No transaction data available
      </div>
    );
  }

  // Aggregate balance by month — take the last balance_after_pence in each month
  const monthMap = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.created_at) continue;
    const ym = tx.created_at.slice(0, 7); // YYYY-MM
    monthMap.set(ym, tx.balance_after_pence);
  }

  // Sort months ascending and build chart data
  const chartData = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, balance]) => ({
      month: formatYearMonth(ym),
      Balance: balance,
    }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="month"
          tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
        />
        <YAxis
          tickFormatter={v => `£${(v / 100).toFixed(0)}`}
          tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
        />
        <Tooltip content={<CustomTooltip />} cursor={false} />
        <Area
          type="monotone"
          dataKey="Balance"
          stroke="var(--color-primary)"
          strokeWidth={2}
          fill="url(#savingsGradient)"
          dot={false}
          activeDot={{ r: 5 }}
          name="Balance"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
