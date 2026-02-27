import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSetting, setSetting } from '../services/settings.js';

const router = Router();
router.use(requireAuth);

export const DEFAULT_EXPENSE_CATEGORIES = [
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

export function getExpenseCategories(): string[] {
  const stored = getSetting('expense_categories');
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
    } catch { /* fall through */ }
  }
  return DEFAULT_EXPENSE_CATEGORIES;
}

// GET /api/categories
router.get('/', (_req: Request, res: Response) => {
  res.json(getExpenseCategories());
});

export default router;
