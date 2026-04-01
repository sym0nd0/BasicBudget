import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Expense } from '../../src/types';

const mockState = vi.hoisted(() => ({
  expenses: [] as Expense[],
  previousExpenses: [] as Expense[],
  activeMonth: '2026-05',
}));

vi.mock('../../src/context/BudgetContext', () => ({
  useBudget: () => ({
    expenses: mockState.expenses,
    accounts: [],
    addExpense: vi.fn(),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn(),
  }),
}));

vi.mock('../../src/context/FilterContext', () => ({
  useFilter: () => ({
    activeMonth: mockState.activeMonth,
    setActiveMonth: vi.fn(),
    filterCategory: 'all',
    setFilterCategory: vi.fn(),
    fromMonth: mockState.activeMonth,
    toMonth: mockState.activeMonth,
    setFromMonth: vi.fn(),
    setToMonth: vi.fn(),
    isRangeActive: false,
    rangeMonths: [mockState.activeMonth],
    rangePreset: '1m',
    setRangePreset: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useApi', () => ({
  useApi: (url: string | null) => ({
    data: url === `/expenses?month=2026-04` ? mockState.previousExpenses : null,
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useRangeOverview', () => ({
  useRangeOverview: () => ({
    isRangeActive: false,
    data: null,
    loading: false,
  }),
}));

vi.mock('../../src/hooks/usePreviousPeriod', () => ({
  usePreviousPeriod: () => null,
}));

vi.mock('../../src/hooks/useSortableTable', () => ({
  useSortableTable: <T,>(items: T[], defaultSortKey: keyof T) => ({
    sorted: items,
    sortKey: defaultSortKey,
    sortDir: 'asc',
    toggleSort: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn(),
    ConfirmDialogElement: null,
  }),
}));

describe('ExpensesPage', () => {
  beforeEach(() => {
    mockState.activeMonth = '2026-05';
    mockState.expenses = [];
    mockState.previousExpenses = [];
  });

  it('keeps the all-expenses share card consistent with the your share table total', async () => {
    mockState.expenses = [
      {
        id: 'expense-1',
        name: 'Weekly Food',
        amount_pence: 1000,
        effective_pence: 5000,
        posting_day: 1,
        category: 'Food & Groceries',
        is_household: false,
        split_ratio: 0.5,
        is_recurring: true,
        recurrence_type: 'weekly',
        start_date: '2026-05-01',
      },
      {
        id: 'expense-2',
        name: 'Utilities',
        amount_pence: 1250,
        effective_pence: 1250,
        posting_day: 15,
        category: 'Utilities',
        is_household: false,
        split_ratio: 1,
        is_recurring: true,
        recurrence_type: 'monthly',
        start_date: '2026-01-01',
      },
    ];

    const { ExpensesPage } = await import('../../src/pages/ExpensesPage');
    const html = renderToStaticMarkup(React.createElement(ExpensesPage, { onMenuClick: vi.fn() }));

    expect(html).toMatch(/Your Share \(All Expenses\).*?£37\.50/s);
    expect(html).toMatch(/Total \(2\).*?£37\.50/s);
  });

  it('renders delta indicators using month-effective expense values', async () => {
    mockState.expenses = [
      {
        id: 'expense-1',
        name: 'Weekly Food',
        amount_pence: 1000,
        effective_pence: 5000,
        posting_day: 1,
        category: 'Food & Groceries',
        is_household: false,
        split_ratio: 1,
        is_recurring: true,
        recurrence_type: 'weekly',
        start_date: '2026-05-01',
      },
    ];
    mockState.previousExpenses = [
      {
        id: 'expense-1',
        name: 'Weekly Food',
        amount_pence: 1000,
        effective_pence: 4000,
        posting_day: 1,
        category: 'Food & Groceries',
        is_household: false,
        split_ratio: 1,
        is_recurring: true,
        recurrence_type: 'weekly',
        start_date: '2026-05-01',
      },
    ];

    const { ExpensesPage } = await import('../../src/pages/ExpensesPage');
    const html = renderToStaticMarkup(React.createElement(ExpensesPage, { onMenuClick: vi.fn() }));

    expect(html).toContain('New');
    expect(html).toContain('↑ £10.00');
    expect(html).toContain('25.00%');
  });

  it('omits delta indicators when the effective month value is unchanged', async () => {
    mockState.expenses = [
      {
        id: 'expense-1',
        name: 'Stable Weekly Food',
        amount_pence: 1000,
        effective_pence: 4000,
        posting_day: 1,
        category: 'Food & Groceries',
        is_household: false,
        split_ratio: 1,
        is_recurring: true,
        recurrence_type: 'weekly',
        start_date: '2026-05-01',
      },
    ];
    mockState.previousExpenses = [
      {
        id: 'expense-1',
        name: 'Stable Weekly Food',
        amount_pence: 1000,
        effective_pence: 4000,
        posting_day: 1,
        category: 'Food & Groceries',
        is_household: false,
        split_ratio: 1,
        is_recurring: true,
        recurrence_type: 'weekly',
        start_date: '2026-05-01',
      },
    ];

    const { ExpensesPage } = await import('../../src/pages/ExpensesPage');
    const html = renderToStaticMarkup(React.createElement(ExpensesPage, { onMenuClick: vi.fn() }));

    expect(html).not.toContain('£0.00');
    expect(html).not.toContain('0.00%');
  });

  it('omits delta indicators when there is no previous-month row', async () => {
    mockState.expenses = [
      {
        id: 'expense-1',
        name: 'Brand New Expense',
        amount_pence: 2500,
        effective_pence: 2500,
        posting_day: 1,
        category: 'Other',
        is_household: false,
        split_ratio: 1,
        is_recurring: true,
        recurrence_type: 'monthly',
        start_date: '2026-05-01',
      },
    ];

    const { ExpensesPage } = await import('../../src/pages/ExpensesPage');
    const html = renderToStaticMarkup(React.createElement(ExpensesPage, { onMenuClick: vi.fn() }));
    const rowMarkup = html.split('Total (1)')[0];

    expect(html).toContain('New');
    expect(rowMarkup).not.toContain('↑ £25.00');
    expect(rowMarkup).not.toContain('↓ £25.00');
  });

  it('lets totals change because of a new row without inventing a numeric row delta', async () => {
    mockState.expenses = [
      {
        id: 'expense-1',
        name: 'Stable Rent',
        amount_pence: 3000,
        effective_pence: 3000,
        posting_day: 1,
        category: 'Housing',
        is_household: false,
        split_ratio: 1,
        is_recurring: true,
        recurrence_type: 'monthly',
        start_date: '2026-01-01',
      },
      {
        id: 'expense-2',
        name: 'New Streaming',
        amount_pence: 900,
        effective_pence: 900,
        posting_day: 12,
        category: 'Subscriptions',
        is_household: false,
        split_ratio: 1,
        is_recurring: true,
        recurrence_type: 'monthly',
        start_date: '2026-05-01',
      },
    ];
    mockState.previousExpenses = [
      {
        id: 'expense-1',
        name: 'Stable Rent',
        amount_pence: 3000,
        effective_pence: 3000,
        posting_day: 1,
        category: 'Housing',
        is_household: false,
        split_ratio: 1,
        is_recurring: true,
        recurrence_type: 'monthly',
        start_date: '2026-01-01',
      },
    ];

    const { ExpensesPage } = await import('../../src/pages/ExpensesPage');
    const html = renderToStaticMarkup(React.createElement(ExpensesPage, { onMenuClick: vi.fn() }));
    const newRowMarkup = html.split('New Streaming')[1]?.split('Total (2)')[0] ?? '';

    expect(html).toContain('↑ £9.00');
    expect(newRowMarkup).not.toContain('↑ £9.00');
    expect(newRowMarkup).not.toContain('↓ £9.00');
    expect(newRowMarkup).toContain('New');
  });
});
