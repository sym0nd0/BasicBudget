import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import type { CategoryBreakdown } from '../../types';

interface ExpenseDonutProps {
  breakdown: CategoryBreakdown[];
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

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-[var(--color-text)]">{entry.name}</p>
      <p style={{ color: entry.payload.fill }}>{formatCurrency(entry.value)}</p>
      <p className="text-[var(--color-text-muted)]">{entry.payload.percentage.toFixed(1)}%</p>
    </div>
  );
};

export function ExpenseDonut({ breakdown }: ExpenseDonutProps) {
  if (breakdown.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-[var(--color-text-muted)] text-sm">
        No expense data
      </div>
    );
  }

  const data = breakdown.map((item, idx) => ({
    name: item.category,
    value: item.total,
    percentage: item.percentage,
    fill: CHART_COLORS[idx % CHART_COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, idx) => (
            <Cell key={`cell-${idx}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => (
            <span style={{ color: 'var(--color-text)', fontSize: 11 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
