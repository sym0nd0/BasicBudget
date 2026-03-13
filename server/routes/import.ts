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
  const errors: { row: number; message: string }[] = [];
  let skipped = 0;

  if (importType === 'expenses') {
    const existingExpenses = db.prepare('SELECT name, amount_pence, type FROM expenses WHERE household_id = ?').all(req.householdId!) as
      { name: string; amount_pence: number; type: string }[];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = row.name?.trim();
        if (!name) throw new Error('name is required');
        const amount = poundsStrToPence(row.amount ?? '');
        if (amount <= 0) throw new Error('amount must be > 0');
        const day = parseInt(row.day ?? '1', 10);
        const category = isValidCategory(row.category?.trim())
          ? row.category.trim()
          : 'Other';
        const type = row.type?.trim() === 'variable' ? 'variable' : 'fixed';
        const isHousehold = /^(yes|true|1)$/i.test(row.household ?? '');
        const splitRatioRaw = row.split_ratio ? parseFloat(row.split_ratio) : null;
        const splitRatio = splitRatioRaw !== null && !isNaN(splitRatioRaw)
          ? Math.min(1, Math.max(0, splitRatioRaw))
          : (isHousehold ? 0.5 : 1.0);
        const recurrenceType = parseRecurrenceType(row.recurrence_type);
        const isRecurring = parseIsRecurring(row.is_recurring);
        const startDate = row.start_date ? (parseUkDate(row.start_date) ?? row.start_date) : null;
        const endDate = row.end_date ? (parseUkDate(row.end_date) ?? row.end_date) : null;

        // Account lookup by name
        let accountId: string | null = null;
        if (row.account?.trim()) {
          const acct = db.prepare('SELECT id FROM accounts WHERE household_id = ? AND LOWER(name) = LOWER(?)').get(req.householdId!, row.account.trim()) as { id: string } | undefined;
          accountId = acct?.id ?? null;
        }

        const isDup = existingExpenses.some(
          ex => ex.name.toLowerCase() === name.toLowerCase()
            && ex.amount_pence === amount && ex.type === type
        );
        if (isDup) { skipped++; continue; }

        const id = randomUUID();
        db.prepare(`
          INSERT INTO expenses
            (id, household_id, user_id, name, amount_pence, posting_day, account_id, type, category,
             is_household, split_ratio, is_recurring, recurrence_type,
             start_date, end_date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, req.householdId!, req.userId!, name, amount, isNaN(day) ? 1 : day,
          accountId, type, category, isHousehold ? 1 : 0, splitRatio,
          isRecurring, recurrenceType,
          startDate, endDate, row.notes ?? null,
        );
        imported.push(id);
        existingExpenses.push({ name, amount_pence: amount, type });
      } catch (err) {
        errors.push({ row: i + 2, message: (err as Error).message });
      }
    }
  } else if (importType === 'incomes') {
    const existingIncomes = db.prepare('SELECT name, amount_pence FROM incomes WHERE household_id = ?').all(req.householdId!) as
      { name: string; amount_pence: number }[];

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

        const isDup = existingIncomes.some(
          ex => ex.name.toLowerCase() === name.toLowerCase() && ex.amount_pence === amount
        );
        if (isDup) { skipped++; continue; }

        const id = randomUUID();
        db.prepare(`
          INSERT INTO incomes
            (id, household_id, user_id, name, amount_pence, posting_day, contributor_name,
             gross_or_net, is_recurring, recurrence_type, start_date, end_date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, req.householdId!, req.userId!, name, amount, isNaN(day) ? 28 : day,
          row.contributor?.trim() ?? null,
          row.gross_or_net?.trim() === 'gross' ? 'gross' : 'net',
          isRecurring, recurrenceType,
          startDate, endDate, row.notes ?? null,
        );
        imported.push(id);
        existingIncomes.push({ name, amount_pence: amount });
      } catch (err) {
        errors.push({ row: i + 2, message: (err as Error).message });
      }
    }
  } else if (importType === 'debts') {
    const existingDebts = db.prepare('SELECT name, balance_pence FROM debts WHERE household_id = ?').all(req.householdId!) as
      { name: string; balance_pence: number }[];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = row.name?.trim();
        if (!name) throw new Error('name is required');
        const balance = poundsStrToPence(row.balance ?? '');
        if (balance <= 0) throw new Error('balance must be > 0');
        const interestRateRaw = parseFloat(row.interest_rate ?? '0');
        if (isNaN(interestRateRaw)) throw new Error('interest_rate must be a number');
        const interestRate = interestRateRaw;
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

        const isDup = existingDebts.some(
          ex => ex.name.toLowerCase() === name.toLowerCase() && ex.balance_pence === balance
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
          id, req.householdId!, req.userId!, name, balance,
          interestRate, minimumPayment, overpayment,
          compoundingFrequency, isNaN(day) ? 1 : day, isHousehold ? 1 : 0, splitRatio,
          isRecurring, recurrenceType, startDate, endDate, row.notes ?? null,
        );
        imported.push(id);
        existingDebts.push({ name, balance_pence: balance });
      } catch (err) {
        errors.push({ row: i + 2, message: (err as Error).message });
      }
    }
  } else if (importType === 'savings') {
    const existingSavings = db.prepare('SELECT name, target_amount_pence FROM savings_goals WHERE household_id = ?').all(req.householdId!) as
      { name: string; target_amount_pence: number }[];

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

        const isDup = existingSavings.some(
          ex => ex.name.toLowerCase() === name.toLowerCase() && ex.target_amount_pence === targetAmount
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
          id, req.householdId!, req.userId!, name, targetAmount,
          currentAmount, monthlyContribution,
          isHousehold ? 1 : 0, targetDate, row.notes ?? null,
        );
        imported.push(id);
        existingSavings.push({ name, target_amount_pence: targetAmount });
      } catch (err) {
        errors.push({ row: i + 2, message: (err as Error).message });
      }
    }
  }

  logger.info('Data import completed', { userId: req.userId, imported: imported.length, skipped, errors: errors.length });
  res.json({
    imported: imported.length, skipped, errors,
    message: `Imported ${imported.length} rows${skipped ? `, skipped ${skipped} duplicate(s)` : ''}${errors.length ? ` with ${errors.length} error(s)` : ''}`,
  });
});

export default router;
