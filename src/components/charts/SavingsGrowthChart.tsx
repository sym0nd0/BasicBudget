import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatYearMonth } from '../../utils/formatters';
import type { SavingsTransaction, SavingsGoal } from '../../types';

interface SavingsGrowthChartProps {
  transactions: SavingsTransaction[];
  goals: SavingsGoal[];
}

const CHART_COLOURS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-[var(--color-text)] mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
};

export function SavingsGrowthChart({ transactions, goals }: SavingsGrowthChartProps) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--color-text-muted)] text-sm">
        No transaction data available for this period
      </div>
    );
  }

  // Build a map of goalId → goal name
  const goalNames = new Map<string, string>(goals.map(g => [g.id, g.name]));

  // Collect unique goal IDs that appear in transactions
  const goalIds = [...new Set(transactions.map(t => t.savings_goal_id))];

  // Group by month: month → goalId → latest balance_after_pence
  const monthGoalBalance = new Map<string, Map<string, number>>();
  const allMonths = new Set<string>();

  // Process in reverse (oldest first) so latest wins for each month/goal pair
  const sorted = [...transactions].sort((a, b) =>
    (a.created_at ?? '').localeCompare(b.created_at ?? '')
  );

  for (const tx of sorted) {
    const month = (tx.created_at ?? '').slice(0, 7);
    if (!month) continue;
    allMonths.add(month);
    if (!monthGoalBalance.has(month)) monthGoalBalance.set(month, new Map());
    monthGoalBalance.get(month)!.set(tx.savings_goal_id, tx.balance_after_pence);
  }

  // Sort months
  const months = [...allMonths].sort();

  // For each month, carry forward last known balance for each goal
  const lastKnown = new Map<string, number>();
  const chartData = months.map(month => {
    const row: Record<string, string | number> = { month: formatYearMonth(month) };
    const monthData = monthGoalBalance.get(month);
    let total = 0;
    for (const goalId of goalIds) {
      if (monthData?.has(goalId)) {
        lastKnown.set(goalId, monthData.get(goalId)!);
      }
      const balance = lastKnown.get(goalId) ?? 0;
      const name = goalNames.get(goalId) ?? goalId;
      row[name] = balance;
      total += balance;
    }
    row['Total'] = total;
    return row;
  });

  const goalAreas = goalIds.map((goalId, i) => {
    const name = goalNames.get(goalId) ?? goalId;
    return { key: name, colour: CHART_COLOURS[i % CHART_COLOURS.length] };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
        <Legend
          formatter={(value) => (
            <span style={{ color: 'var(--color-text)', fontSize: 11 }}>{value}</span>
          )}
        />
        {goalAreas.map(({ key, colour }) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colour}
            fill={colour}
            fillOpacity={0.15}
            strokeWidth={2}
            dot={false}
            stackId="goals"
          />
        ))}
        <Area
          type="monotone"
          dataKey="Total"
          stroke="var(--color-primary)"
          fill="var(--color-primary)"
          fillOpacity={0}
          strokeWidth={2.5}
          dot={false}
          strokeDasharray="4 2"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
