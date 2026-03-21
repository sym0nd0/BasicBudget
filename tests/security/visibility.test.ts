import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { getApp, makeTestUser } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;
let agentA: ReturnType<typeof supertest.agent>;
let agentB: ReturnType<typeof supertest.agent>;

async function csrfToken(agent: ReturnType<typeof supertest.agent>): Promise<string> {
  const r = await agent.get('/api/auth/csrf-token');
  return (r.body as { token?: string }).token ?? '';
}

beforeAll(async () => {
  app = await getApp();

  // Create two users — each gets their own household (cross-household isolation tests)
  agentA = supertest.agent(app);
  agentB = supertest.agent(app);

  const userA = makeTestUser('vis_a');
  const userB = makeTestUser('vis_b');

  let csrf = await csrfToken(agentA);
  await agentA.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: userA.email, password: userA.password });
  csrf = await csrfToken(agentA);
  await agentA.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email: userA.email, password: userA.password });

  csrf = await csrfToken(agentB);
  await agentB.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: userB.email, password: userB.password });
  csrf = await csrfToken(agentB);
  await agentB.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email: userB.email, password: userB.password });
});

// ─── Cross-household isolation ───────────────────────────────────────────────
// Each registered user gets their own household. Entries in one household are
// never visible to a user in a different household, regardless of visibility
// settings. These tests verify that isolation holds for all entity types.

describe('Entry visibility and permissions', () => {
  describe('expenses: cross-household isolation', () => {
    it('User A expense is NOT visible to User B in a different household', async () => {
      const csrf = await csrfToken(agentA);
      const createRes = await agentA
        .post('/api/expenses')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'A Private Expense',
          amount_pence: 1000,
          posting_day: 1,
          category: 'Other',
          is_household: false,
          is_recurring: true,
          recurrence_type: 'monthly',
        });
      const expenseId = (createRes.body as { id: string }).id;

      const getRes = await agentB.get('/api/expenses?month=2025-01');
      const expenses = Array.isArray(getRes.body) ? (getRes.body as unknown[]) : [];
      const found = expenses.some((e: Record<string, unknown>) => e.id === expenseId);
      expect(found).toBe(false);
    });

    it('User A household expense is NOT visible to User B in a different household', async () => {
      const csrf = await csrfToken(agentA);
      const createRes = await agentA
        .post('/api/expenses')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'Household Expense Isolation',
          amount_pence: 3000,
          posting_day: 1,
          category: 'Other',
          is_household: true,
          split_ratio: 0.5,
          is_recurring: true,
          recurrence_type: 'monthly',
        });
      const expenseId = (createRes.body as { id: string }).id;

      const getRes = await agentB.get('/api/expenses?month=2025-01');
      const expenses = Array.isArray(getRes.body) ? (getRes.body as unknown[]) : [];
      const found = expenses.some((e: Record<string, unknown>) => e.id === expenseId);
      expect(found).toBe(false);
    });

    it('User B cannot edit User A expense by ID (different household → 404)', async () => {
      let csrf = await csrfToken(agentA);
      const createRes = await agentA
        .post('/api/expenses')
        .set('X-CSRF-Token', csrf)
        .send({ name: 'A Expense For Edit Test', amount_pence: 1000, posting_day: 1, category: 'Other', is_household: false, is_recurring: true, recurrence_type: 'monthly' });
      const expenseId = (createRes.body as { id: string }).id;

      csrf = await csrfToken(agentB);
      const editRes = await agentB
        .put(`/api/expenses/${expenseId}`)
        .set('X-CSRF-Token', csrf)
        .send({ name: 'Hacked' });
      expect(editRes.status).toBe(404);
    });
  });

  describe('incomes: cross-household isolation', () => {
    it('User A income is NOT visible to User B in a different household', async () => {
      const csrf = await csrfToken(agentA);
      const createRes = await agentA
        .post('/api/incomes')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'A Salary Isolation',
          amount_pence: 500000,
          posting_day: 28,
          gross_or_net: 'net',
          is_recurring: true,
          recurrence_type: 'monthly',
        });
      const incomeId = (createRes.body as { id: string }).id;

      const getRes = await agentB.get('/api/incomes?month=2025-01');
      const incomes = Array.isArray(getRes.body) ? (getRes.body as unknown[]) : [];
      const found = incomes.some((i: Record<string, unknown>) => i.id === incomeId);
      expect(found).toBe(false);
    });

    it('User B cannot edit User A income (different household → 404)', async () => {
      let csrf = await csrfToken(agentA);
      const createRes = await agentA
        .post('/api/incomes')
        .set('X-CSRF-Token', csrf)
        .send({ name: 'A Income For Edit Test', amount_pence: 100000, posting_day: 28, gross_or_net: 'net', is_recurring: true, recurrence_type: 'monthly' });
      const incomeId = (createRes.body as { id: string }).id;

      csrf = await csrfToken(agentB);
      const editRes = await agentB
        .put(`/api/incomes/${incomeId}`)
        .set('X-CSRF-Token', csrf)
        .send({ name: 'Hacked' });
      expect(editRes.status).toBe(404);
    });
  });

  describe('debts: cross-household isolation', () => {
    it('User A debt is NOT visible to User B in a different household', async () => {
      const csrf = await csrfToken(agentA);
      const createRes = await agentA
        .post('/api/debts')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'A Credit Card Isolation',
          balance_pence: 50000,
          interest_rate: 19.9,
          minimum_payment_pence: 1000,
          posting_day: 1,
          is_recurring: true,
          recurrence_type: 'monthly',
        });
      const debtId = (createRes.body as { id: string }).id;

      const getRes = await agentB.get('/api/debts');
      const debts = Array.isArray(getRes.body) ? (getRes.body as unknown[]) : [];
      const found = debts.some((d: Record<string, unknown>) => d.id === debtId);
      expect(found).toBe(false);
    });
  });

  describe('savings goals: cross-household isolation', () => {
    it('User A savings goal is NOT visible to User B in a different household', async () => {
      const csrf = await csrfToken(agentA);
      const createRes = await agentA
        .post('/api/savings-goals')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'A Vacation Fund Isolation',
          target_amount_pence: 300000,
          current_amount_pence: 50000,
          monthly_contribution_pence: 10000,
        });
      const goalId = (createRes.body as { id: string }).id;

      const getRes = await agentB.get('/api/savings-goals');
      const goals = Array.isArray(getRes.body) ? (getRes.body as unknown[]) : [];
      const found = goals.some((g: Record<string, unknown>) => g.id === goalId);
      expect(found).toBe(false);
    });
  });

  // ─── Dashboard summary visibility ─────────────────────────────────────────
  // Each user's dashboard summary only reflects their own household data.

  describe('dashboard summary: per-user visibility', () => {
    it('User A summary includes their own expense', async () => {
      const csrf = await csrfToken(agentA);
      await agentA
        .post('/api/expenses')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'My Summary Expense',
          amount_pence: 10000,
          posting_day: 1,
          category: 'Other',
          is_household: false,
          is_recurring: true,
          recurrence_type: 'monthly',
        });

      const summaryRes = await agentA.get('/api/summary?month=2025-01');
      expect(summaryRes.status).toBe(200);
      const summary = summaryRes.body as { total_expenses_pence?: number };
      expect(summary.total_expenses_pence).toBeGreaterThan(0);
    });

    it('User B summary expenses are 0 (B has no expenses)', async () => {
      // B has not created any expenses — their summary should show 0 for expenses
      const summaryRes = await agentB.get('/api/summary?month=2025-01');
      expect(summaryRes.status).toBe(200);
      const summary = summaryRes.body as { total_expenses_pence?: number };
      // A's expenses are in a different household so B should see 0
      expect(summary.total_expenses_pence).toBe(0);
    });

    it('User A summary includes their income', async () => {
      const csrf = await csrfToken(agentA);
      await agentA
        .post('/api/incomes')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'My Summary Salary',
          amount_pence: 300000,
          posting_day: 28,
          gross_or_net: 'net',
          is_recurring: true,
          recurrence_type: 'monthly',
        });

      const summaryRes = await agentA.get('/api/summary?month=2025-01');
      expect(summaryRes.status).toBe(200);
      const summary = summaryRes.body as { total_income_pence?: number };
      expect(summary.total_income_pence).toBeGreaterThan(0);
    });
  });

  describe('export respects visibility', () => {
    it('User export does not include other users\' private entries', async () => {
      const csrf = await csrfToken(agentA);
      await agentA
        .post('/api/expenses')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'A Only Export Unique',
          amount_pence: 5000,
          posting_day: 1,
          category: 'Other',
          is_household: false,
          is_recurring: true,
          recurrence_type: 'monthly',
        });

      const exportRes = await agentB.get('/api/export/json');
      const exported = exportRes.body as { expenses?: unknown[] };
      const expenses = (exported.expenses || []) as Record<string, unknown>[];
      const found = expenses.some(e => (e.name as string)?.includes('A Only Export Unique'));
      expect(found).toBe(false);
    });
  });
});
