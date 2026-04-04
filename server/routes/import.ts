import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import db from '../db.js';
import { parseCsv, parseUkDate, poundsStrToPence } from '../utils/csv-parser.js';
import { EXPENSE_CATEGORIES } from '../../shared/types.js';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../services/logger.js';

const router = Router();
router.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

type ExpenseCategoryType = (typeof EXPENSE_CATEGORIES)[number];

interface ExistingExpenseRow {
  readonly user_id: string;
  readonly contributor_user_id: string | null;
  readonly name: string;
  readonly amount_pence: number;
  readonly posting_day: number;
  readonly account_id: string | null;
  readonly category: string;
  readonly is_household: number;
  readonly split_ratio: number;
  readonly is_recurring: number;
  readonly recurrence_type: string;
  readonly start_date: string | null;
  readonly end_date: string | null;
  readonly notes: string | null;
}

function isValidCategory(c: string): c is ExpenseCategoryType {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(c);
}

const VALID_RECURRENCE_TYPES = ['monthly', 'weekly', 'yearly', 'fortnightly'] as const;

function parseRecurrenceType(val: string | undefined): string {
  const v = val?.trim().toLowerCase() ?? '';
  return (VALID_RECURRENCE_TYPES as readonly string[]).includes(v) ? v : 'monthly';
}

function parseIsRecurring(val: string | undefined): number {
  if (val === undefined || val === '') return 1;
  return /^(yes|true|1)$/i.test(val) ? 1 : 0;
}

function norm(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') return v.trim().toLowerCase();
  if (typeof v === 'boolean') return v ? '1' : '0';
  return String(v);
}

function expenseRowsMatch(
  existing: ExistingExpenseRow,
  imported: {
    readonly userId: string;
    readonly name: string;
    readonly amount: number;
    readonly day: number;
    readonly accountId: string | null;
    readonly category: string;
    readonly isHousehold: boolean;
    readonly splitRatio: number;
    readonly isRecurring: number;
    readonly recurrenceType: string;
    readonly startDate: string | null;
    readonly endDate: string | null;
    readonly notes: string | null;
  },
): boolean {
  return norm(existing.user_id) === norm(imported.userId)
    && norm(existing.contributor_user_id) === null
    && norm(existing.name) === norm(imported.name)
    && norm(existing.amount_pence) === norm(imported.amount)
    && norm(existing.posting_day) === norm(imported.day)
    && norm(existing.account_id) === norm(imported.accountId)
    && norm(existing.category) === norm(imported.category)
    && norm(existing.is_household) === norm(imported.isHousehold)
    && norm(existing.split_ratio) === norm(imported.splitRatio)
    && norm(existing.is_recurring) === norm(imported.isRecurring)
    && norm(existing.recurrence_type) === norm(imported.recurrenceType)
    && norm(existing.start_date) === norm(imported.startDate)
    && norm(existing.end_date) === norm(imported.endDate)
    && norm(existing.notes) === norm(imported.notes);
}

router.post('/csv', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  const importType = (req.body as { type?: string }).type ?? 'expenses';
  const text = req.file.buffer.toString('utf8');
  const rows = parseCsv(text);

  if (rows.length === 0) {
    res.status(400).json({ message: 'CSV is empty or has no data rows' });
    return;
  }

  const imported: string[] = [];
  let skipped = 0;

  if (importType === 'expenses') {
    const existingExpenses = db.prepare(`
      SELECT user_id, contributor_user_id, name, amount_pence, posting_day, account_id,
             category, is_household, split_ratio, is_recurring, recurrence_type,
             start_date, end_date, notes
      FROM expenses
      WHERE household_id = ?
    `).all(req.householdId!) as unknown as ExistingExpenseRow[];

    // Phase 1 — validation pass (no DB writes)
    type ExpenseRow = {
      name: string; amount: number; day: number; category: string;
      isHousehold: boolean; splitRatio: number; recurrenceType: string; isRecurring: number;
      startDate: string | null; endDate: string | null; notes: string | null;
      accountName: string | null;
    };
    const validRows: ExpenseRow[] = [];
    const validationErrors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = row.name?.trim();
        if (!name) throw new Error('name is required');
        const amount = poundsStrToPence(row.amount ?? '');
        if (amount <= 0) throw new Error('amount must be > 0');
        const day = parseInt(row.day ?? '1', 10);
        const category = isValidCategory(row.category?.trim()) ? row.category.trim() : 'Other';
        const isHousehold = /^(yes|true|1)$/i.test(row.household ?? '');
        const splitRatioRaw = row.split_ratio ? parseFloat(row.split_ratio) : null;
        const splitRatio = splitRatioRaw !== null && !isNaN(splitRatioRaw)
          ? Math.min(1, Math.max(0, splitRatioRaw))
          : (isHousehold ? 0.5 : 1.0);
        const recurrenceType = parseRecurrenceType(row.recurrence_type);
        const isRecurring = parseIsRecurring(row.is_recurring);
        const startDate = row.start_date ? (parseUkDate(row.start_date) ?? row.start_date) : null;
        const endDate = row.end_date ? (parseUkDate(row.end_date) ?? row.end_date) : null;
        validRows.push({
          name, amount, day: isNaN(day) ? 1 : day, category, isHousehold,
          splitRatio, recurrenceType, isRecurring, startDate, endDate,
          notes: row.notes ?? null, accountName: row.account?.trim() ?? null,
        });
      } catch (err) {
        validationErrors.push({ row: i + 2, message: (err as Error).message });
      }
    }

    if (validationErrors.length > 0) {
      res.status(400).json({ message: 'Validation failed', errors: validationErrors });
      return;
    }

    // Phase 2 — atomic insert
    db.transaction(() => {
      for (const r of validRows) {
        let accountId: string | null = null;
        if (r.accountName) {
          const acct = db.prepare('SELECT id FROM accounts WHERE household_id = ? AND LOWER(name) = LOWER(?)').get(req.householdId!, r.accountName) as { id: string } | undefined;
          accountId = acct?.id ?? null;
        }

        const isDup = existingExpenses.some(ex => expenseRowsMatch(ex, {
          userId: req.userId!,
          name: r.name,
          amount: r.amount,
          day: r.day,
          accountId,
          category: r.category,
          isHousehold: r.isHousehold,
          splitRatio: r.splitRatio,
          isRecurring: r.isRecurring,
          recurrenceType: r.recurrenceType,
          startDate: r.startDate,
          endDate: r.endDate,
          notes: r.notes,
        }));
        if (isDup) { skipped++; continue; }

        const id = randomUUID();
        db.prepare(`
          INSERT INTO expenses
            (id, household_id, user_id, name, amount_pence, posting_day, account_id, category,
             is_household, split_ratio, is_recurring, recurrence_type,
             start_date, end_date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, req.householdId!, req.userId!, r.name, r.amount, r.day,
          accountId, r.category, r.isHousehold ? 1 : 0, r.splitRatio,
          r.isRecurring, r.recurrenceType,
          r.startDate, r.endDate, r.notes,
        );
        imported.push(id);
        existingExpenses.push({
          user_id: req.userId!,
          contributor_user_id: null,
          name: r.name,
          amount_pence: r.amount,
          posting_day: r.day,
          account_id: accountId,
          category: r.category,
          is_household: r.isHousehold ? 1 : 0,
          split_ratio: r.splitRatio,
          is_recurring: r.isRecurring,
          recurrence_type: r.recurrenceType,
          start_date: r.startDate,
          end_date: r.endDate,
          notes: r.notes,
        });
      }
    })();
  } else if (importType === 'incomes') {
    const existingIncomes = db.prepare('SELECT name, amount_pence FROM incomes WHERE household_id = ?').all(req.householdId!) as
      { name: string; amount_pence: number }[];

    // Phase 1 — validation pass
    type IncomeRow = {
      name: string; amount: number; day: number; contributorName: string | null;
      grossOrNet: string; isRecurring: number; recurrenceType: string;
      startDate: string | null; endDate: string | null; notes: string | null;
    };
    const validRows: IncomeRow[] = [];
    const validationErrors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = row.name?.trim();
        if (!name) throw new Error('name is required');
        const amount = poundsStrToPence(row.amount ?? '');
        if (amount <= 0) throw new Error('amount must be > 0');
        const day = parseInt(row.day ?? '28', 10);
        const recurrenceType = parseRecurrenceType(row.recurrence_type);
        const isRecurring = parseIsRecurring(row.is_recurring);
        const startDate = row.start_date ? (parseUkDate(row.start_date) ?? row.start_date) : null;
        const endDate = row.end_date ? (parseUkDate(row.end_date) ?? row.end_date) : null;
        validRows.push({
          name, amount, day: isNaN(day) ? 28 : day,
          contributorName: row.contributor?.trim() ?? null,
          grossOrNet: row.gross_or_net?.trim() === 'gross' ? 'gross' : 'net',
          isRecurring, recurrenceType, startDate, endDate, notes: row.notes ?? null,
        });
      } catch (err) {
        validationErrors.push({ row: i + 2, message: (err as Error).message });
      }
    }

    if (validationErrors.length > 0) {
      res.status(400).json({ message: 'Validation failed', errors: validationErrors });
      return;
    }

    // Phase 2 — atomic insert
    db.transaction(() => {
      for (const r of validRows) {
        const isDup = existingIncomes.some(
          ex => ex.name.toLowerCase() === r.name.toLowerCase() && ex.amount_pence === r.amount
        );
        if (isDup) { skipped++; continue; }

        const id = randomUUID();
        db.prepare(`
          INSERT INTO incomes
            (id, household_id, user_id, name, amount_pence, posting_day, contributor_name,
             gross_or_net, is_recurring, recurrence_type, start_date, end_date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, req.householdId!, req.userId!, r.name, r.amount, r.day,
          r.contributorName, r.grossOrNet,
          r.isRecurring, r.recurrenceType,
          r.startDate, r.endDate, r.notes,
        );
        imported.push(id);
        existingIncomes.push({ name: r.name, amount_pence: r.amount });
      }
    })();
  } else if (importType === 'debts') {
    const existingDebts = db.prepare('SELECT name, balance_pence FROM debts WHERE household_id = ?').all(req.householdId!) as
      { name: string; balance_pence: number }[];

    // Phase 1 — validation pass
    type DebtRow = {
      name: string; balance: number; interestRate: number; minimumPayment: number;
      overpayment: number; compoundingFrequency: string; day: number;
      isHousehold: boolean; splitRatio: number; isRecurring: number; recurrenceType: string;
      startDate: string | null; endDate: string | null; notes: string | null;
    };
    const validRows: DebtRow[] = [];
    const validationErrors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = row.name?.trim();
        if (!name) throw new Error('name is required');
        const balance = poundsStrToPence(row.balance ?? '');
        if (balance <= 0) throw new Error('balance must be > 0');
        const interestRateRaw = parseFloat(row.interest_rate ?? '0');
        if (isNaN(interestRateRaw)) throw new Error('interest_rate must be a number');
        const minimumPayment = poundsStrToPence(row.minimum_payment ?? '0');
        const overpayment = row.overpayment ? poundsStrToPence(row.overpayment) : 0;
        const compoundingFrequency = row.compounding_frequency?.trim() || 'monthly';
        const day = parseInt(row.day ?? '1', 10);
        const isHousehold = /^(yes|true|1)$/i.test(row.is_household ?? '');
        const splitRatioRaw = row.split_ratio ? parseFloat(row.split_ratio) : null;
        const splitRatio = splitRatioRaw !== null && !isNaN(splitRatioRaw)
          ? Math.min(1, Math.max(0, splitRatioRaw))
          : (isHousehold ? 0.5 : 1.0);
        const recurrenceType = parseRecurrenceType(row.recurrence_type);
        const isRecurring = parseIsRecurring(row.is_recurring);
        const startDate = row.start_date ? (parseUkDate(row.start_date) ?? row.start_date) : null;
        const endDate = row.end_date ? (parseUkDate(row.end_date) ?? row.end_date) : null;
        validRows.push({
          name, balance, interestRate: interestRateRaw, minimumPayment, overpayment,
          compoundingFrequency, day: isNaN(day) ? 1 : day, isHousehold, splitRatio,
          isRecurring, recurrenceType, startDate, endDate, notes: row.notes ?? null,
        });
      } catch (err) {
        validationErrors.push({ row: i + 2, message: (err as Error).message });
      }
    }

    if (validationErrors.length > 0) {
      res.status(400).json({ message: 'Validation failed', errors: validationErrors });
      return;
    }

    // Phase 2 — atomic insert
    db.transaction(() => {
      for (const r of validRows) {
        const isDup = existingDebts.some(
          ex => ex.name.toLowerCase() === r.name.toLowerCase() && ex.balance_pence === r.balance
        );
        if (isDup) { skipped++; continue; }

        const id = randomUUID();
        db.prepare(`
          INSERT INTO debts
            (id, household_id, user_id, name, balance_pence,
             interest_rate, minimum_payment_pence, overpayment_pence,
             compounding_frequency, posting_day, is_household, split_ratio,
             is_recurring, recurrence_type, start_date, end_date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, req.householdId!, req.userId!, r.name, r.balance,
          r.interestRate, r.minimumPayment, r.overpayment,
          r.compoundingFrequency, r.day, r.isHousehold ? 1 : 0, r.splitRatio,
          r.isRecurring, r.recurrenceType, r.startDate, r.endDate, r.notes,
        );
        imported.push(id);
        existingDebts.push({ name: r.name, balance_pence: r.balance });
      }
    })();
  } else if (importType === 'savings') {
    const existingSavings = db.prepare('SELECT name, target_amount_pence FROM savings_goals WHERE household_id = ?').all(req.householdId!) as
      { name: string; target_amount_pence: number }[];

    // Phase 1 — validation pass
    type SavingsRow = {
      name: string; targetAmount: number; currentAmount: number;
      monthlyContribution: number; isHousehold: boolean;
      targetDate: string | null; notes: string | null;
    };
    const validRows: SavingsRow[] = [];
    const validationErrors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = row.name?.trim();
        if (!name) throw new Error('name is required');
        const targetAmount = poundsStrToPence(row.target_amount ?? '');
        if (targetAmount <= 0) throw new Error('target_amount must be > 0');
        const currentAmount = row.current_amount ? poundsStrToPence(row.current_amount) : 0;
        const monthlyContribution = row.monthly_contribution ? poundsStrToPence(row.monthly_contribution) : 0;
        const isHousehold = /^(yes|true|1)$/i.test(row.is_household ?? '');
        const targetDate = row.target_date ? (parseUkDate(row.target_date) ?? row.target_date) : null;
        validRows.push({ name, targetAmount, currentAmount, monthlyContribution, isHousehold, targetDate, notes: row.notes ?? null });
      } catch (err) {
        validationErrors.push({ row: i + 2, message: (err as Error).message });
      }
    }

    if (validationErrors.length > 0) {
      res.status(400).json({ message: 'Validation failed', errors: validationErrors });
      return;
    }

    // Phase 2 — atomic insert
    db.transaction(() => {
      for (const r of validRows) {
        const isDup = existingSavings.some(
          ex => ex.name.toLowerCase() === r.name.toLowerCase() && ex.target_amount_pence === r.targetAmount
        );
        if (isDup) { skipped++; continue; }

        const id = randomUUID();
        db.prepare(`
          INSERT INTO savings_goals
            (id, household_id, user_id, name, target_amount_pence,
             current_amount_pence, monthly_contribution_pence,
             is_household, target_date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, req.householdId!, req.userId!, r.name, r.targetAmount,
          r.currentAmount, r.monthlyContribution,
          r.isHousehold ? 1 : 0, r.targetDate, r.notes,
        );
        imported.push(id);
        existingSavings.push({ name: r.name, target_amount_pence: r.targetAmount });
      }
    })();
  }

  logger.info('Data import completed', { userId: req.userId, imported: imported.length, skipped });
  res.json({
    imported: imported.length, skipped, errors: [],
    message: `Imported ${imported.length} rows${skipped ? `, skipped ${skipped} duplicate(s)` : ''}`,
  });
});

export default router;
