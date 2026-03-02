import { z } from 'zod';

// ─── Common patterns ──────────────────────────────────────────────────────────

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
export const monthParam = z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM');

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const expenseSchema = z.object({
  name: z.string().min(1).max(200),
  amount_pence: z.number().int().min(0),
  posting_day: z.number().int().min(1).max(31).optional(),
  account_id: z.string().max(36).nullable().optional(),
  type: z.enum(['fixed', 'variable']).optional(),
  category: z.string().max(100).optional(),
  is_household: z.boolean().optional(),
  split_ratio: z.number().min(0).max(1).optional(),
  is_recurring: z.boolean().optional(),
  recurrence_type: z.enum(['monthly', 'weekly', 'yearly', 'fortnightly']).optional(),
  start_date: dateStr.nullable().optional(),
  end_date: dateStr.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// ─── Income ───────────────────────────────────────────────────────────────────

export const incomeSchema = z.object({
  name: z.string().min(1).max(200),
  amount_pence: z.number().int().min(0),
  posting_day: z.number().int().min(1).max(31).optional(),
  contributor_name: z.string().max(200).nullable().optional(),
  gross_or_net: z.enum(['gross', 'net']).optional(),
  is_recurring: z.boolean().optional(),
  recurrence_type: z.enum(['monthly', 'weekly', 'yearly', 'fortnightly']).optional(),
  start_date: dateStr.nullable().optional(),
  end_date: dateStr.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// ─── Debts ────────────────────────────────────────────────────────────────────

const dealPeriodSchema = z.object({
  label: z.string().max(100).nullable().optional(),
  interest_rate: z.number().min(0).max(100),
  start_date: dateStr,
  end_date: dateStr.nullable().optional(),
});

export const debtSchema = z.object({
  name: z.string().min(1).max(200),
  balance_pence: z.number().int().min(0),
  interest_rate: z.number().min(0).max(100).optional(),
  minimum_payment_pence: z.number().int().min(0).optional(),
  overpayment_pence: z.number().int().min(0).optional(),
  compounding_frequency: z.string().max(50).optional(),
  posting_day: z.number().int().min(1).max(31).optional(),
  is_household: z.boolean().optional(),
  is_recurring: z.boolean().optional(),
  recurrence_type: z.enum(['monthly', 'weekly', 'yearly']).optional(),
  start_date: dateStr.nullable().optional(),
  end_date: dateStr.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  reminder_months: z.number().int().min(0).max(24).optional(),
  deal_periods: z.array(dealPeriodSchema).optional(),
});

// ─── Savings Goals ────────────────────────────────────────────────────────────

export const savingsGoalSchema = z.object({
  name: z.string().min(1).max(200),
  target_amount_pence: z.number().int().min(0).optional(),
  current_amount_pence: z.number().int().min(0).optional(),
  monthly_contribution_pence: z.number().int().min(0).optional(),
  target_date: dateStr.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// ─── Accounts ─────────────────────────────────────────────────────────────────

export const accountSchema = z.object({
  name: z.string().min(1).max(200),
  sort_order: z.number().int().optional(),
  is_joint: z.boolean().optional(),
});
