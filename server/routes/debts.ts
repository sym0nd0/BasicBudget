import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { randomUUID } from 'node:crypto';
import { isMonthLocked } from './months.js';
import type { Debt, AmortizationRow, DebtPayoffSummary } from '../../shared/types.js';

const router = Router();

function mapDebt(row: Record<string, unknown>): Debt {
  return {
    ...(row as Omit<Debt, 'is_recurring' | 'is_household'>),
    is_recurring: Boolean(row.is_recurring),
    is_household: Boolean(row.is_household),
  };
}

// GET /api/debts
router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM debts ORDER BY created_at').all() as Record<string, unknown>[];
  res.json(rows.map(mapDebt));
});

// POST /api/debts
router.post('/', (req: Request, res: Response) => {
  const body = req.body as Partial<Debt>;
  if (!body.name?.trim()) {
    res.status(400).json({ message: 'name is required' });
    return;
  }
  if (typeof body.balance_pence !== 'number' || body.balance_pence < 0) {
    res.status(400).json({ message: 'balance_pence must be a non-negative integer' });
    return;
  }
  const recurrenceType = body.recurrence_type ?? 'monthly';
  if (!['monthly', 'weekly', 'yearly'].includes(recurrenceType)) {
    res.status(400).json({ message: "recurrence_type must be 'monthly', 'weekly', or 'yearly'" });
    return;
  }
  const isHousehold = Boolean(body.is_household);
  const splitRatio = isHousehold ? 0.5 : 1.0;
  const id = randomUUID();
  try {
    db.prepare(`
      INSERT INTO debts
        (id, name, balance_pence, interest_rate, minimum_payment_pence,
         overpayment_pence, compounding_frequency, is_recurring, recurrence_type,
         posting_day, start_date, end_date, is_household, split_ratio, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.name.trim(),
      body.balance_pence,
      body.interest_rate ?? 0,
      body.minimum_payment_pence ?? 0,
      body.overpayment_pence ?? 0,
      body.compounding_frequency ?? 'monthly',
      body.is_recurring ? 1 : 0,
      recurrenceType,
      body.posting_day ?? 1,
      body.start_date ?? null,
      body.end_date ?? null,
      isHousehold ? 1 : 0,
      splitRatio,
      body.notes ?? null,
    );
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  const row = db.prepare('SELECT * FROM debts WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json(mapDebt(row));
});

// PUT /api/debts/:id
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body as Partial<Debt>;
  const existing = db.prepare('SELECT * FROM debts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ message: 'Debt not found' });
    return;
  }
  const startDate = (body.start_date ?? existing.start_date) as string | null;
  if (startDate) {
    const ym = startDate.slice(0, 7);
    if (isMonthLocked(ym)) {
      res.status(409).json({ message: `Month ${ym} is locked` });
      return;
    }
  }
  if (body.recurrence_type !== undefined && !['monthly', 'weekly', 'yearly'].includes(body.recurrence_type)) {
    res.status(400).json({ message: "recurrence_type must be 'monthly', 'weekly', or 'yearly'" });
    return;
  }
  const updIsHousehold = body.is_household !== undefined ? Boolean(body.is_household) : Boolean(existing.is_household);
  const updSplitRatio = updIsHousehold ? 0.5 : 1.0;
  try {
    db.prepare(`
      UPDATE debts SET
        name = ?, balance_pence = ?, interest_rate = ?,
        minimum_payment_pence = ?, overpayment_pence = ?,
        compounding_frequency = ?, is_recurring = ?, recurrence_type = ?,
        posting_day = ?, start_date = ?, end_date = ?,
        is_household = ?, split_ratio = ?, notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      body.name?.trim() ?? existing.name,
      body.balance_pence ?? existing.balance_pence,
      body.interest_rate ?? existing.interest_rate,
      body.minimum_payment_pence ?? existing.minimum_payment_pence,
      body.overpayment_pence ?? existing.overpayment_pence,
      body.compounding_frequency ?? existing.compounding_frequency,
      body.is_recurring !== undefined ? (body.is_recurring ? 1 : 0) : existing.is_recurring,
      body.recurrence_type ?? existing.recurrence_type,
      body.posting_day ?? existing.posting_day,
      body.start_date !== undefined ? body.start_date : existing.start_date,
      body.end_date !== undefined ? body.end_date : existing.end_date,
      updIsHousehold ? 1 : 0,
      updSplitRatio,
      body.notes !== undefined ? body.notes : existing.notes,
      id,
    );
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  const row = db.prepare('SELECT * FROM debts WHERE id = ?').get(id) as Record<string, unknown>;
  res.json(mapDebt(row));
});

// DELETE /api/debts/:id
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM debts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ message: 'Debt not found' });
    return;
  }
  const startDate = existing.start_date as string | null;
  if (startDate) {
    const ym = startDate.slice(0, 7);
    if (isMonthLocked(ym)) {
      res.status(409).json({ message: `Month ${ym} is locked` });
      return;
    }
  }
  try {
    db.prepare('DELETE FROM debts WHERE id = ?').run(id);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  res.status(204).send();
});

// GET /api/debts/:id/amortisation
router.get('/:id/amortisation', (req: Request, res: Response) => {
  const { id } = req.params;
  const row = db.prepare('SELECT * FROM debts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ message: 'Debt not found' });
    return;
  }
  const debt = mapDebt(row);
  const summary = computeAmortization(debt);
  res.json(summary);
});

const MAX_MONTHS = 600;

export function computeAmortization(debt: Debt): DebtPayoffSummary {
  const monthlyRate = debt.interest_rate / 100 / 12;
  const paymentPence = debt.minimum_payment_pence + debt.overpayment_pence;
  const schedule: AmortizationRow[] = [];

  let currentBalance = debt.balance_pence;
  let totalInterestPaid = 0;
  let totalPaid = 0;
  let month = 0;

  const now = new Date();
  const startYear = now.getFullYear();
  const startMonth = now.getMonth(); // 0-indexed

  while (currentBalance > 0 && month < MAX_MONTHS) {
    month++;
    const openingBalance = currentBalance;
    // Interest in pence (rounded to nearest penny)
    const interestCharge = Math.round(openingBalance * monthlyRate);
    const balanceWithInterest = openingBalance + interestCharge;
    // Final payment may be less
    const payment = Math.min(paymentPence, balanceWithInterest);
    const principalPaid = payment - interestCharge;
    const closingBalance = Math.max(0, balanceWithInterest - payment);

    totalInterestPaid += interestCharge;
    totalPaid += payment;

    const paymentDate = new Date(startYear, startMonth + month, 1);
    const dateStr = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;

    schedule.push({
      month,
      date: dateStr,
      opening_balance_pence: openingBalance,
      interest_charge_pence: interestCharge,
      payment_pence: payment,
      principal_paid_pence: principalPaid,
      closing_balance_pence: closingBalance,
    });

    currentBalance = closingBalance;
  }

  const payoffDate = schedule.length > 0 ? schedule[schedule.length - 1].date : '';

  return {
    debtId: debt.id,
    debtName: debt.name,
    monthsToPayoff: month,
    totalInterestPaidPence: totalInterestPaid,
    totalPaidPence: totalPaid,
    payoffDate,
    schedule,
  };
}

export default router;
