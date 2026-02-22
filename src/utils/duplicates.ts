import type { Income, Expense, Debt, SavingsGoal } from '../types';

// Normalize a value so null/undefined/'' are treated as equivalent,
// strings are compared case-insensitively, numbers/booleans by value.
function norm(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') return v.trim().toLowerCase();
  if (typeof v === 'boolean') return v ? '1' : '0';
  return String(v);
}

function eq(a: unknown, b: unknown): boolean {
  return norm(a) === norm(b);
}

export function findDuplicateIncome(items: Income[], data: Omit<Income, 'id' | 'created_at' | 'updated_at'>): Income | undefined {
  return items.find(i =>
    eq(i.name, data.name) &&
    eq(i.amount_pence, data.amount_pence) &&
    eq(i.posting_day, data.posting_day) &&
    eq(i.contributor_name, data.contributor_name) &&
    eq(i.gross_or_net, data.gross_or_net) &&
    eq(i.is_recurring, data.is_recurring) &&
    eq(i.recurrence_type, data.recurrence_type) &&
    eq(i.start_date, data.start_date) &&
    eq(i.end_date, data.end_date)
  );
}

export function findDuplicateExpense(items: Expense[], data: Omit<Expense, 'id' | 'created_at' | 'updated_at'>): Expense | undefined {
  return items.find(e =>
    eq(e.name, data.name) &&
    eq(e.amount_pence, data.amount_pence) &&
    eq(e.posting_day, data.posting_day) &&
    eq(e.account_id, data.account_id) &&
    eq(e.type, data.type) &&
    eq(e.category, data.category) &&
    eq(e.is_household, data.is_household) &&
    eq(e.split_ratio, data.split_ratio) &&
    eq(e.is_recurring, data.is_recurring) &&
    eq(e.recurrence_type, data.recurrence_type) &&
    eq(e.start_date, data.start_date) &&
    eq(e.end_date, data.end_date)
  );
}

export function findDuplicateDebt(items: Debt[], data: Omit<Debt, 'id' | 'created_at' | 'updated_at'>): Debt | undefined {
  return items.find(d =>
    eq(d.name, data.name) &&
    eq(d.balance_pence, data.balance_pence) &&
    eq(d.interest_rate, data.interest_rate) &&
    eq(d.minimum_payment_pence, data.minimum_payment_pence) &&
    eq(d.overpayment_pence, data.overpayment_pence) &&
    eq(d.compounding_frequency, data.compounding_frequency) &&
    eq(d.is_recurring, data.is_recurring) &&
    eq(d.recurrence_type, data.recurrence_type) &&
    eq(d.posting_day, data.posting_day) &&
    eq(d.start_date, data.start_date) &&
    eq(d.end_date, data.end_date) &&
    eq(d.is_household, data.is_household) &&
    eq(d.split_ratio, data.split_ratio)
  );
}

export function findDuplicateSavingsGoal(items: SavingsGoal[], data: Omit<SavingsGoal, 'id' | 'created_at' | 'updated_at'>): SavingsGoal | undefined {
  return items.find(g =>
    eq(g.name, data.name) &&
    eq(g.target_amount_pence, data.target_amount_pence) &&
    eq(g.current_amount_pence, data.current_amount_pence) &&
    eq(g.monthly_contribution_pence, data.monthly_contribution_pence) &&
    eq(g.target_date, data.target_date)
  );
}
