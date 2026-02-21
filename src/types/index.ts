// ─── Core Data Models ─────────────────────────────────────────────────────────

export interface Income {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  notes?: string;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  account: 'First Direct' | 'Natwest' | 'Cash' | 'Other';
  type: 'fixed' | 'variable';
  category: ExpenseCategory;
  isHousehold: boolean;
  /** 0.5 for household split, 1.0 for sole expenses */
  splitRatio: number;
  notes?: string;
}

export type ExpenseCategory =
  | 'Housing'
  | 'Transport'
  | 'Food & Groceries'
  | 'Utilities'
  | 'Subscriptions'
  | 'Personal'
  | 'Health'
  | 'Entertainment'
  | 'Debt Payments'
  | 'Savings'
  | 'Other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Housing',
  'Transport',
  'Food & Groceries',
  'Utilities',
  'Subscriptions',
  'Personal',
  'Health',
  'Entertainment',
  'Debt Payments',
  'Savings',
  'Other',
];

export const ACCOUNTS = ['First Direct', 'Natwest', 'Cash', 'Other'] as const;

// ─── Debt Models ──────────────────────────────────────────────────────────────

export interface Debt {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  currentPayment: number;
  notes?: string;
}

export interface AmortizationRow {
  month: number;
  date: string;
  openingBalance: number;
  interestCharge: number;
  payment: number;
  principalPaid: number;
  closingBalance: number;
}

export interface DebtPayoffSummary {
  debtId: string;
  debtName: string;
  monthsToPayoff: number;
  totalInterestPaid: number;
  totalPaid: number;
  payoffDate: string;
  schedule: AmortizationRow[];
}

// ─── Budget Summary ────────────────────────────────────────────────────────────

export interface CategoryBreakdown {
  category: ExpenseCategory;
  total: number;
  percentage: number;
}

export interface BudgetSummary {
  totalIncome: number;
  totalExpenses: number;
  totalDebtPayments: number;
  disposableIncome: number;
  categoryBreakdown: CategoryBreakdown[];
}

// ─── Theme ────────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark' | 'system';
