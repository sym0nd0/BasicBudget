// ─── Auth types ────────────────────────────────────────────────────────────────

export type SystemRole = 'admin' | 'user';
export type HouseholdRole = 'owner' | 'member';

export interface User {
  id: string;
  email: string;
  display_name: string;
  email_verified: boolean;
  system_role: SystemRole;
  created_at?: string;
}

export interface Household {
  id: string;
  name: string;
  created_at?: string;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  joined_at?: string;
  // joined from users table
  email?: string;
  display_name?: string;
}

export interface SessionInfo {
  sid: string;
  user_agent?: string | null;
  ip_address?: string | null;
  created_at?: string;
  expired: number;
  current?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name?: string;
}

export interface TotpSetupResponse {
  otpauthUrl: string;
  qrDataUrl: string;
  base32Secret: string;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  totpPending: boolean;
  user?: User;
  household?: Household;
  householdRole?: HouseholdRole;
}

// ─── Account ───────────────────────────────────────────────────────────────────

export interface Account {
  id: string;
  household_id?: string;
  user_id?: string;
  name: string;
  sort_order: number;
  created_at?: string;
}

// ─── Income ────────────────────────────────────────────────────────────────────

export interface Income {
  id: string;
  household_id?: string;
  user_id?: string;
  name: string;
  amount_pence: number;
  posting_day: number;
  contributor_name?: string | null;
  gross_or_net: 'gross' | 'net';
  is_recurring: boolean;
  recurrence_type: 'monthly' | 'weekly' | 'yearly';
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── Expense ───────────────────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
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
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense {
  id: string;
  household_id?: string;
  user_id?: string;
  name: string;
  amount_pence: number;
  posting_day: number;
  account_id?: string | null;
  type: 'fixed' | 'variable';
  category: ExpenseCategory;
  is_household: boolean;
  split_ratio: number;
  is_recurring: boolean;
  recurrence_type: 'monthly' | 'weekly' | 'yearly';
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── Debt ──────────────────────────────────────────────────────────────────────

export interface Debt {
  id: string;
  household_id?: string;
  user_id?: string;
  name: string;
  balance_pence: number;
  interest_rate: number;
  minimum_payment_pence: number;
  overpayment_pence: number;
  compounding_frequency: string;
  is_recurring: boolean;
  recurrence_type: string;
  posting_day: number;
  start_date?: string | null;
  end_date?: string | null;
  is_household: boolean;
  split_ratio: number;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── Savings Goal ──────────────────────────────────────────────────────────────

export interface SavingsGoal {
  id: string;
  household_id?: string;
  user_id?: string;
  name: string;
  target_amount_pence: number;
  current_amount_pence: number;
  monthly_contribution_pence: number;
  target_date?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── Month Lock ────────────────────────────────────────────────────────────────

export interface MonthLock {
  year_month: string;
  household_id?: string;
  locked_at: string;
}

// ─── Amortization ──────────────────────────────────────────────────────────────

export interface AmortizationRow {
  month: number;
  date: string;
  opening_balance_pence: number;
  interest_charge_pence: number;
  payment_pence: number;
  principal_paid_pence: number;
  closing_balance_pence: number;
}

export interface DebtPayoffSummary {
  debtId: string;
  debtName: string;
  monthsToPayoff: number;
  totalInterestPaidPence: number;
  totalPaidPence: number;
  payoffDate: string;
  schedule: AmortizationRow[];
}

// ─── Budget Summary ────────────────────────────────────────────────────────────

export interface CategoryBreakdown {
  category: string;
  total_pence: number;
  percentage: number;
}

export interface BudgetSummary {
  total_income_pence: number;
  total_expenses_pence: number;
  total_debt_payments_pence: number;
  disposable_income_pence: number;
  category_breakdown: CategoryBreakdown[];
}

// ─── Household Overview ────────────────────────────────────────────────────────

export interface HouseholdOverview {
  total_income_pence: number;
  total_expenses_pence: number;
  shared_expenses_pence: number;
  sole_expenses_pence: number;
  debt_payments_pence: number;
  disposable_income_pence: number;
  debt_to_income_ratio: number;
}

// ─── Theme ────────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark' | 'system';
