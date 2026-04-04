import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { logValidationFailure } from '../middleware/validate.js';
import { inviteLimiter } from '../middleware/rate-limit.js';
import { consumeTokenById, createToken, validateToken } from '../auth/tokens.js';
import { sendHouseholdInvite } from '../services/email.js';
import { filterActiveInMonth, currentYearMonth, mapDebtToRecurringItem, type RecurringItem } from '../utils/recurring.js';
import type { HouseholdOverview, CategoryBreakdown, SavingsGoal } from '../../shared/types.js';
import { logger } from '../services/logger.js';
import { monthParam } from '../validation/schemas.js';

const router = Router();
router.use(requireAuth);

function revokeUserSessions(userId: string): void {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

function moveUserToSoloHousehold(userId: string, sourceHouseholdId: string): string {
  const userRow = db.prepare('SELECT display_name, email FROM users WHERE id = ?').get(userId) as {
    display_name: string;
    email: string;
  } | undefined;
  const fallbackName = userRow?.display_name?.trim() || userRow?.email?.split('@')[0] || 'My';
  const newHouseholdId = randomUUID();

  db.transaction(() => {
    db.prepare('INSERT INTO households (id, name) VALUES (?, ?)').run(newHouseholdId, `${fallbackName}'s Household`);
    db.prepare(`
      INSERT INTO household_members (household_id, user_id, role)
      VALUES (?, ?, 'owner')
    `).run(newHouseholdId, userId);

    db.prepare(`
      UPDATE accounts
      SET household_id = ?
      WHERE household_id = ? AND user_id = ? AND is_joint = 0
    `).run(newHouseholdId, sourceHouseholdId, userId);

    db.prepare(`
      UPDATE incomes
      SET household_id = ?
      WHERE household_id = ? AND is_household = 0 AND (user_id = ? OR contributor_user_id = ?)
    `).run(newHouseholdId, sourceHouseholdId, userId, userId);

    db.prepare(`
      UPDATE expenses
      SET household_id = ?
      WHERE household_id = ? AND is_household = 0 AND (user_id = ? OR contributor_user_id = ?)
    `).run(newHouseholdId, sourceHouseholdId, userId, userId);

    db.prepare(`
      UPDATE debts
      SET household_id = ?
      WHERE household_id = ? AND is_household = 0 AND (user_id = ? OR contributor_user_id = ?)
    `).run(newHouseholdId, sourceHouseholdId, userId, userId);

    const movedGoalIds = db.prepare(`
      SELECT id
      FROM savings_goals
      WHERE household_id = ? AND is_household = 0 AND (user_id = ? OR contributor_user_id = ?)
    `).all(sourceHouseholdId, userId, userId) as Array<{ id: string }>;

    db.prepare(`
      UPDATE savings_goals
      SET household_id = ?
      WHERE household_id = ? AND is_household = 0 AND (user_id = ? OR contributor_user_id = ?)
    `).run(newHouseholdId, sourceHouseholdId, userId, userId);

    for (const goal of movedGoalIds) {
      db.prepare('UPDATE savings_transactions SET household_id = ? WHERE savings_goal_id = ?').run(newHouseholdId, goal.id);
    }

    db.prepare(`
      UPDATE debt_balance_snapshots
      SET household_id = ?
      WHERE household_id = ? AND debt_id IN (
        SELECT id FROM debts WHERE household_id = ? AND is_household = 0 AND (user_id = ? OR contributor_user_id = ?)
      )
    `).run(newHouseholdId, sourceHouseholdId, newHouseholdId, userId, userId);
  })();

  return newHouseholdId;
}

// GET /api/household
router.get('/', (req: Request, res: Response) => {
  const householdRow = db.prepare('SELECT * FROM households WHERE id = ?').get(req.householdId!) as Record<string, unknown> | undefined;
  if (!householdRow) { res.status(404).json({ message: 'Household not found' }); return; }

  const members = db.prepare(`
    SELECT hm.user_id, hm.role, hm.joined_at, u.email, u.display_name
    FROM household_members hm
    JOIN users u ON u.id = hm.user_id
    WHERE hm.household_id = ?
    ORDER BY hm.joined_at
  `).all(req.householdId!) as Record<string, unknown>[];

  res.json({ ...householdRow, members });
});

// PUT /api/household
router.put('/', requireOwner, (req: Request, res: Response) => {
  const schema = z.object({ name: z.string().min(1).max(100) });
  const result = schema.safeParse(req.body);
  if (!result.success) {
    logValidationFailure(req, result.error.issues, 'household.update');
    res.status(400).json({ message: result.error.issues[0]?.message ?? 'Validation error' });
    return;
  }

  db.prepare('UPDATE households SET name = ? WHERE id = ?').run(result.data.name.trim(), req.householdId!);
  const row = db.prepare('SELECT * FROM households WHERE id = ?').get(req.householdId!) as Record<string, unknown>;
  res.json(row);
});

// POST /api/household/invite
router.post('/invite', requireOwner, inviteLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const schema = z.object({ email: z.email() });
  const result = schema.safeParse(req.body);
  if (!result.success) {
    logValidationFailure(req, result.error.issues, 'household.invite');
    res.status(400).json({ message: result.error.issues[0]?.message ?? 'Validation error' });
    return;
  }

  const inviterRow = db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.userId!) as { display_name: string } | undefined;
  const householdRow = db.prepare('SELECT name FROM households WHERE id = ?').get(req.householdId!) as { name: string } | undefined;

  const token = createToken(req.userId!, 'invite');
  // Store householdId in new_email field and invitee email in invitee_email field
  db.prepare("UPDATE reset_tokens SET new_email = ?, invitee_email = ? WHERE token_hash = (SELECT token_hash FROM reset_tokens WHERE type = 'invite' AND user_id = ? ORDER BY created_at DESC LIMIT 1)").run(req.householdId!, result.data.email, req.userId!);

  try {
    await sendHouseholdInvite(
      result.data.email,
      inviterRow?.display_name ?? 'Someone',
      householdRow?.name ?? 'a household',
      token,
    );
  } catch (err) {
    db.prepare(`
      DELETE FROM reset_tokens
      WHERE id = (
        SELECT id
        FROM reset_tokens
        WHERE type = 'invite'
          AND user_id = ?
          AND new_email = ?
          AND invitee_email = ?
          AND used = 0
        ORDER BY created_at DESC
        LIMIT 1
      )
    `).run(req.userId!, req.householdId!, result.data.email);
    logger.warn('Household invite email delivery failed', {
      request_id: req.requestId,
      householdId: req.householdId,
      userId: req.userId,
      error: err,
    });
    next(err);
    return;
  }

  res.json({ message: 'Invitation sent.' });
});

// GET /api/household/invites — list active (unused, unexpired) invites for the household
router.get('/invites', requireOwner, (req: Request, res: Response) => {
  const rows = db.prepare(
    `SELECT id, invitee_email, created_at, expires_at
     FROM reset_tokens
     WHERE type = 'invite' AND new_email = ? AND used = 0
       AND expires_at > datetime('now')
     ORDER BY created_at DESC`,
  ).all(req.householdId!) as Record<string, unknown>[];
  res.json(rows);
});

// DELETE /api/household/invites/:id — rescind an active invite
router.delete('/invites/:id', requireOwner, (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const result = db.prepare(
    `DELETE FROM reset_tokens
     WHERE id = ? AND type = 'invite' AND new_email = ? AND used = 0`,
  ).run(id, req.householdId!);
  if (result.changes === 0) { res.status(404).json({ message: 'Invite not found.' }); return; }
  logger.info('Invite rescinded', {
    request_id: req.requestId,
    id,
    householdId: req.householdId,
    rescindedBy: req.userId,
  });
  res.json({ message: 'Invite rescinded.' });
});

// POST /api/household/accept-invite
router.post('/accept-invite', (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };
  if (!token) { res.status(400).json({ message: 'Token is required' }); return; }

  const inviteToken = validateToken(token, 'invite');
  if (!inviteToken?.newEmail || !inviteToken.inviteeEmail) {
    // newEmail field was re-used to store householdId for invites
    res.status(400).json({ message: 'Invalid or expired invite token' });
    return;
  }

  const userRow = db.prepare('SELECT email FROM users WHERE id = ?').get(req.userId!) as { email: string } | undefined;
  if (!userRow || userRow.email.toLowerCase() !== inviteToken.inviteeEmail.toLowerCase()) {
    res.status(403).json({ message: 'This invite was sent to a different email address' });
    return;
  }

  const targetHouseholdId = inviteToken.newEmail;

  // Check if user is already a member
  const existing = db.prepare('SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?').get(targetHouseholdId, req.userId!);
  if (existing) {
    res.status(409).json({ message: 'You are already a member of this household' });
    return;
  }

  consumeTokenById(inviteToken.id);
  db.prepare("INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, 'member')").run(targetHouseholdId, req.userId!);

  // Update session
  req.session.householdId = targetHouseholdId;
  req.session.householdRole = 'member';

  const householdRow = db.prepare('SELECT * FROM households WHERE id = ?').get(targetHouseholdId) as Record<string, unknown>;
  logger.info('Household invite accepted', {
    request_id: req.requestId,
    householdId: targetHouseholdId,
    userId: req.userId,
  });
  res.json({ message: 'You have joined the household.', household: householdRow });
});

// PUT /api/household/members/:userId/role
router.put('/members/:userId/role', requireOwner, (req: Request, res: Response) => {
  const targetUserId = req.params['userId'] as string;
  const schema = z.object({ role: z.enum(['owner', 'member']) });
  const result = schema.safeParse(req.body);
  if (!result.success) {
    logValidationFailure(req, result.error.issues, 'household.member-role');
    res.status(400).json({ message: 'role must be owner or member' });
    return;
  }

  // Prevent demoting sole owner
  if (result.data.role === 'member') {
    const owners = db.prepare("SELECT COUNT(*) as c FROM household_members WHERE household_id = ? AND role = 'owner'").get(req.householdId!) as { c: number };
    const isTargetOwner = db.prepare("SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ? AND role = 'owner'").get(req.householdId!, targetUserId);
    if (isTargetOwner && owners.c <= 1) {
      res.status(400).json({ message: 'Cannot demote the sole owner of a household' });
      return;
    }
  }

  const roleUpdate = db.prepare('UPDATE household_members SET role = ? WHERE household_id = ? AND user_id = ?').run(result.data.role, req.householdId!, targetUserId);
  if (roleUpdate.changes === 0) {
    logger.warn('Household member role update skipped because no row matched', {
      request_id: req.requestId,
      householdId: req.householdId,
      targetUserId,
      newRole: result.data.role,
      changedBy: req.userId,
    });
    res.status(404).json({ message: 'Member not found' });
    return;
  }
  logger.info('Household member role changed', {
    request_id: req.requestId,
    householdId: req.householdId,
    targetUserId,
    newRole: result.data.role,
    changedBy: req.userId,
  });
  revokeUserSessions(targetUserId);
  res.json({ message: 'Role updated.' });
});

// DELETE /api/household/members/:userId
router.delete('/members/:userId', (req: Request, res: Response) => {
  const targetUserId = req.params['userId'] as string;
  const isSelf = targetUserId === req.userId;

  if (!isSelf && req.householdRole !== 'owner') {
    res.status(403).json({ message: 'Only the household owner can remove other members' });
    return;
  }

  // Prevent removing sole owner
  const memberRow = db.prepare('SELECT role FROM household_members WHERE household_id = ? AND user_id = ?').get(req.householdId!, targetUserId) as { role: string } | undefined;
  if (!memberRow) { res.status(404).json({ message: 'Member not found' }); return; }
  if (memberRow.role === 'owner') {
    const ownerCount = db.prepare("SELECT COUNT(*) as c FROM household_members WHERE household_id = ? AND role = 'owner'").get(req.householdId!) as { c: number };
    if (ownerCount.c <= 1) {
      res.status(400).json({ message: 'Cannot remove the sole owner from a household' });
      return;
    }
  }

  const sourceHouseholdId = req.householdId!;
  db.prepare('DELETE FROM household_members WHERE household_id = ? AND user_id = ?').run(sourceHouseholdId, targetUserId);
  const newHouseholdId = moveUserToSoloHousehold(targetUserId, sourceHouseholdId);
  revokeUserSessions(targetUserId);
  logger.info('Household member removed', {
    request_id: req.requestId,
    householdId: sourceHouseholdId,
    newHouseholdId,
    targetUserId,
    removedBy: req.userId,
    isSelf,
  });
  res.status(204).send();
});

// GET /api/household/summary?month=YYYY-MM
router.get('/summary', (req: Request, res: Response) => {
  const rawMonth = (req.query.month as string) ?? currentYearMonth();
  const monthResult = monthParam.safeParse(rawMonth);
  if (!monthResult.success) {
    logValidationFailure(req, monthResult.error.issues, 'household.summary.month');
    res.status(400).json({ message: 'Invalid month format' });
    return;
  }
  const month = monthResult.data;

  const allIncomes = db.prepare('SELECT * FROM incomes WHERE household_id = ?').all(req.householdId!) as RecurringItem[];
  const allExpenses = db.prepare('SELECT * FROM expenses WHERE household_id = ?').all(req.householdId!) as RecurringItem[];
  const allDebts = db.prepare('SELECT * FROM debts WHERE household_id = ?').all(req.householdId!) as Record<string, unknown>[];

  const activeIncomes = filterActiveInMonth(allIncomes, month);
  const activeExpenses = filterActiveInMonth(allExpenses, month);

  const totalIncomePence = activeIncomes
    .filter(i => Boolean(i.is_household))
    .reduce((s, i) => s + (i.effective_pence ?? 0), 0);
  const sharedExpensesPence = activeExpenses.filter(e => Boolean(e.is_household)).reduce((s, e) => s + (e.effective_pence ?? 0), 0);
  const soleExpensesPence = activeExpenses.filter(e => !e.is_household).reduce((s, e) => s + (e.effective_pence ?? 0), 0);
  const allDebtItems = allDebts.map(mapDebtToRecurringItem);
  const activeDebtItems = filterActiveInMonth(allDebtItems, month);
  const householdDebts = activeDebtItems.filter(d => Boolean(d.is_household));
  const debtPaymentsPence = householdDebts.reduce((s, d) => s + (d.effective_pence ?? 0), 0);
  const totalDebtBalancePence = allDebts.filter(d => Boolean(d.is_household)).reduce((s, d) => s + (d.balance_pence as number), 0);

  // Get all household savings (only joint savings for household overview)
  const allSavings = db.prepare('SELECT monthly_contribution_pence, is_household FROM savings_goals WHERE household_id = ? AND is_household = 1').all(req.householdId!) as SavingsGoal[];
  const householdSavingsPence = allSavings.reduce((s, g) => s + (g.monthly_contribution_pence ?? 0), 0);

  const householdActiveExpenses = activeExpenses.filter(e => Boolean(e.is_household));
  const categoryMap = new Map<string, number>();
  for (const e of householdActiveExpenses) {
    const cat = (e.category as string) ?? 'Other';
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + (e.effective_pence ?? 0));
  }
  const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([category, total_pence]) => ({
      category,
      total_pence,
      percentage: sharedExpensesPence > 0 ? (total_pence / sharedExpensesPence) * 100 : 0,
    }))
    .sort((a, b) => b.total_pence - a.total_pence);

  const overview: HouseholdOverview = {
    total_income_pence: totalIncomePence,
    total_expenses_pence: sharedExpensesPence,
    shared_expenses_pence: sharedExpensesPence,
    sole_expenses_pence: soleExpensesPence,
    debt_payments_pence: debtPaymentsPence,
    household_savings_pence: householdSavingsPence,
    disposable_income_pence: totalIncomePence - sharedExpensesPence - debtPaymentsPence - householdSavingsPence,
    debt_to_income_ratio: totalIncomePence > 0 ? Math.round((debtPaymentsPence / totalIncomePence) * 1000) / 10 : 0,
    total_debt_balance_pence: totalDebtBalancePence,
    category_breakdown: categoryBreakdown,
  };

  res.json(overview);
});

export default router;
