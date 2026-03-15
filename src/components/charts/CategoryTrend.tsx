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
import type { MonthlyReportRow } from '../../types';

interface CategoryTrendProps {
  data: MonthlyReportRow[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg p-3 text-sm max-w-xs">
      <p className="font-semibold text-[var(--color-text)] mb-1">{label}</p>
      {payload
        .slice()
        .reverse()
        .map((entry: any) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
    </div>
  );
};

export function CategoryTrend({ data }: CategoryTrendProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)] text-sm">
        No data available
      </div>
    );
  }

  // Get top 6 categories by total across all months
  const categoryTotals = new Map<string, number>();
  for (const row of data) {
    for (const cat of row.category_breakdown) {
      categoryTotals.set(cat.category, (categoryTotals.get(cat.category) ?? 0) + cat.total_pence);
    }
  }

  const topCategories = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name]) => name);

  // Pivot: for each month, sum spending by category
  const chartData = data.map(row => {
    const month_data: any = { month: formatYearMonth(row.month) };
    const categorySpending = new Map<string, number>();

    for (const cat of row.category_breakdown) {
      categorySpending.set(cat.category, cat.total_pence);
    }

    // Add top 6 categories
    for (const cat of topCategories) {
      month_data[cat] = categorySpending.get(cat) ?? 0;
    }

    // Calculate "Other"
    let other = 0;
    for (const [cat, amount] of categorySpending) {
      if (!topCategories.includes(cat)) {
        other += amount;
      }
    }
    month_data['Other'] = other;

    return month_data;
  });

  const COLORS = [
    'var(--color-chart-1)',
    'var(--color-chart-2)',
    'var(--color-chart-3)',
    'var(--color-chart-4)',
    'var(--color-chart-5)',
    'var(--color-chart-6)',
    'var(--color-chart-7)',
  ];

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
        {/* Top 6 categories */}
        {topCategories.map((cat, idx) => (
          <Area
            key={cat}
            type="monotone"
            dataKey={cat}
            stackId="spending"
            fill={COLORS[idx % COLORS.length]}
            stroke="none"
            name={cat}
          />
        ))}
        {/* Other */}
        <Area
          type="monotone"
          dataKey="Other"
          stackId="spending"
          fill={COLORS[6]}
          stroke="none"
          name="Other"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
