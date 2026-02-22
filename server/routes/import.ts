import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import db from '../db.js';
import { parseCsv, parseUkDate, poundsStrToPence } from '../utils/csv-parser.js';
import { EXPENSE_CATEGORIES } from '../../shared/types.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

type ExpenseCategoryType = (typeof EXPENSE_CATEGORIES)[number];

function isValidCategory(c: string): c is ExpenseCategoryType {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(c);
}

/**
 * POST /api/import/csv
 * Expects multipart/form-data with a `file` field (CSV) and a `type` field ('expenses' | 'incomes').
 *
 * Expected CSV columns for expenses:
 *   name, amount, day, category, type, account, household, notes, start_date, end_date
 *
 * Expected CSV columns for incomes:
 *   name, amount, day, contributor, gross_or_net, notes, start_date, end_date
 *
 * Dates should be DD/MM/YYYY (UK format) or YYYY-MM-DD (ISO).
 * Amounts should be in pounds (e.g. 12.50).
 */
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
    const existingExpenses = db.prepare('SELECT name, amount_pence, type FROM expenses').all() as
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
        const splitRatio = isHousehold ? 0.5 : 1.0;
        const startDate = row.start_date ? (parseUkDate(row.start_date) ?? row.start_date) : null;
        const endDate = row.end_date ? (parseUkDate(row.end_date) ?? row.end_date) : null;

        const isDup = existingExpenses.some(
          ex => ex.name.toLowerCase() === name.toLowerCase()
            && ex.amount_pence === amount && ex.type === type
        );
        if (isDup) { skipped++; continue; }

        const id = randomUUID();
        db.prepare(`
          INSERT INTO expenses
            (id, name, amount_pence, posting_day, type, category,
             is_household, split_ratio, is_recurring, recurrence_type,
             start_date, end_date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'monthly', ?, ?, ?)
        `).run(
          id, name, amount, isNaN(day) ? 1 : day,
          type, category, isHousehold ? 1 : 0, splitRatio,
          startDate, endDate, row.notes ?? null,
        );
        imported.push(id);
        existingExpenses.push({ name, amount_pence: amount, type });
      } catch (err) {
        errors.push({ row: i + 2, message: (err as Error).message });
      }
    }
  } else {
    // incomes
    const existingIncomes = db.prepare('SELECT name, amount_pence FROM incomes').all() as
      { name: string; amount_pence: number }[];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = row.name?.trim();
        if (!name) throw new Error('name is required');
        const amount = poundsStrToPence(row.amount ?? '');
        if (amount <= 0) throw new Error('amount must be > 0');
        const day = parseInt(row.day ?? '28', 10);
        const startDate = row.start_date ? (parseUkDate(row.start_date) ?? row.start_date) : null;
        const endDate = row.end_date ? (parseUkDate(row.end_date) ?? row.end_date) : null;

        const isDup = existingIncomes.some(
          ex => ex.name.toLowerCase() === name.toLowerCase() && ex.amount_pence === amount
        );
        if (isDup) { skipped++; continue; }

        const id = randomUUID();
        db.prepare(`
          INSERT INTO incomes
            (id, name, amount_pence, posting_day, contributor_name,
             gross_or_net, is_recurring, recurrence_type, start_date, end_date, notes)
          VALUES (?, ?, ?, ?, ?, ?, 1, 'monthly', ?, ?, ?)
        `).run(
          id, name, amount, isNaN(day) ? 28 : day,
          row.contributor?.trim() ?? null,
          row.gross_or_net?.trim() === 'gross' ? 'gross' : 'net',
          startDate, endDate, row.notes ?? null,
        );
        imported.push(id);
        existingIncomes.push({ name, amount_pence: amount });
      } catch (err) {
        errors.push({ row: i + 2, message: (err as Error).message });
      }
    }
  }

  res.json({
    imported: imported.length, skipped, errors,
    message: `Imported ${imported.length} rows${skipped ? `, skipped ${skipped} duplicate(s)` : ''}${errors.length ? ` with ${errors.length} error(s)` : ''}`,
  });
});

export default router;
