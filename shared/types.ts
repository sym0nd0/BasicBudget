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
  has_totp?: boolean;
  colour_palette?: string;
  notify_updates?: boolean;
}

export interface VersionInfo {
  current: string;
  latest: string | null;
  update_available: boolean;
  checked_at: string | null;
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
  browser?: string;
  os?: string;
  device?: string;
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
  is_joint?: boolean;
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
  contributor_user_id?: string | null;
  is_household?: boolean;
  gross_or_net: 'gross' | 'net';
  is_recurring: boolean;
  recurrence_type: 'monthly' | 'weekly' | 'yearly' | 'fortnightly';
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
  contributor_user_id?: string | null;
  name: string;
  amount_pence: number;
  posting_day: number;
  account_id?: string | null;
  category: string;
  is_household: boolean;
  split_ratio: number;
  is_recurring: boolean;
  recurrence_type: 'monthly' | 'weekly' | 'yearly' | 'fortnightly';
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  range_full_pence?: number;
  range_share_pence?: number;
}

// ─── Debt ──────────────────────────────────────────────────────────────────────

// ─── Debt Deal Period ─────────────────────────────────────────────────────────────

export interface DebtDealPeriod {
  id: string;
  debt_id: string;
  label?: string | null;
  interest_rate: number;
  start_date: string;
  end_date?: string | null;
  created_at?: string;
}

// ─── Debt ──────────────────────────────────────────────────────────────────────────

export interface Debt {
  id: string;
  household_id?: string;
  user_id?: string;
  contributor_user_id?: string | null;
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
  reminder_months?: number;
  deal_periods?: DebtDealPeriod[];
  created_at?: string;
  updated_at?: string;
}

// ─── Savings Goal ──────────────────────────────────────────────────────────────

export interface SavingsGoal {
  id: string;
  household_id?: string;
  user_id?: string;
  contributor_user_id?: string | null;
  name: string;
  target_amount_pence: number;
  current_amount_pence: number;
  monthly_contribution_pence: number;
  is_household: 0 | 1; // 0 = personal, 1 = joint (split equally among all household members)
  target_date?: string | null;
  notes?: string | null;
  auto_contribute?: 0 | 1; // SQLite integer boolean
  contribution_day?: number; // 1–28
  created_at?: string;
  updated_at?: string;
}

export type SavingsTransactionType = 'contribution' | 'deposit' | 'withdrawal';

export interface SavingsTransaction {
  id: string;
  savings_goal_id: string;
  household_id: string;
  user_id: string;
  type: SavingsTransactionType;
  amount_pence: number;
  balance_after_pence: number;
  notes?: string | null;
  created_at?: string;
  goal_name?: string; // populated when joining with savings_goals
}

// ─── Month Lock ────────────────────────────────────────────────────────────────

export interface MonthLock {
  year_month: string;
  household_id?: string;
  locked_at: string;
}

// ─── Repayments ──────────────────────────────────────────────────────────────

export interface RepaymentRow {
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
  schedule: RepaymentRow[];
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
  total_savings_pence: number;
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
  household_savings_pence: number;
  disposable_income_pence: number;
  debt_to_income_ratio: number;
  total_debt_balance_pence: number;
  category_breakdown?: CategoryBreakdown[];
}

// ─── Theme ────────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark' | 'system';

// ─── Admin types ──────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  system_role: SystemRole;
  email_verified: boolean;
  locked_until: string | null;
  created_at: string;
  has_totp: boolean;
  has_oidc: boolean;
  household_count: number;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface OidcConfig {
  issuer_url: string;
  client_id: string;
  client_secret: string;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
}

export interface RegistrationConfig {
  disabled: boolean;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_email?: string;
  action: string;
  detail: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Reports ──────────────────────────────────────────────────────────────

export type ReportRange = '1m' | '3m' | '6m' | '12m' | 'custom';

export interface MonthlyReportRow {
  month: string;
  income_pence: number;
  expenses_pence: number;
  debt_payments_pence: number;
  savings_pence: number;
  disposable_pence: number;
  category_breakdown: CategoryBreakdown[];
}

export interface DebtPerDebtBreakdown {
  id: string;
  name: string;
  balance_pence: number;
}

export interface DebtProjectionPoint {
  month: string;
  total_balance_pence: number;
  is_actual: boolean;
  per_debt: DebtPerDebtBreakdown[];
}

export interface DebtPayoffTimelinePoint {
  month: string;
  total_balance_pence: number;
  is_actual: boolean;
  per_debt: DebtPerDebtBreakdown[];
}

export interface DebtPayoffStrategyResult {
  months: DebtPayoffTimelinePoint[];
  payoff_dates: Record<string, string>;
  total_payoff_date: string | null;
}
