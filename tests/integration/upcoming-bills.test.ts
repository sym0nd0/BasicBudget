import { beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import db from '../../server/db.js';
import { getApp, getCsrfToken, makeTestUser, registerAndLoginDirect } from '../helpers.js';
import type { UpcomingBillsReportResponse } from '../../shared/types.js';

let app: Awaited<ReturnType<typeof getApp>>;

beforeAll(async () => {
  app = await getApp();
});

async function loginAgent(suffix: string) {
  const agent = supertest.agent(app);
  await registerAndLoginDirect(agent, makeTestUser(suffix));
  return agent;
}

function futureYearMonth(monthsAhead: number): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + monthsAhead);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function lastDayOfMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const day = new Date(year, month, 0).getDate();
  return String(day).padStart(2, '0');
}

describe('GET /api/reports/upcoming-bills', () => {
  it('requires authentication', async () => {
    await supertest(app).get('/api/reports/upcoming-bills?month=2026-05').expect(401);
  });

  it('rejects invalid month values', async () => {
    const agent = await loginAgent('upcoming_invalid');

    const res = await agent.get('/api/reports/upcoming-bills?month=2026-13').expect(400);

    expect(res.body).toMatchObject({ message: 'Invalid month format' });
  });

  it('returns expenses, debt payments, and auto savings contributions using user-share amounts', async () => {
    const agent = await loginAgent('upcoming_sources');
    const csrf = await getCsrfToken(agent);
    const futureMonth = futureYearMonth(2);

    await agent
      .post('/api/expenses')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Rent',
        amount_pence: 120000,
        posting_day: 31,
        category: 'Housing',
        is_household: true,
        split_ratio: 0.5,
        is_recurring: true,
        recurrence_type: 'monthly',
        start_date: `${futureMonth}-01`,
      })
      .expect(201);

    await agent
      .post('/api/debts')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Credit Card',
        balance_pence: 500000,
        minimum_payment_pence: 30000,
        overpayment_pence: 5000,
        interest_rate: 0,
        recurrence_type: 'monthly',
        start_date: `${futureMonth}-01`,
        is_recurring: true,
        is_household: false,
        posting_day: 12,
      })
      .expect(201);

    await agent
      .post('/api/savings-goals')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Emergency Fund',
        target_amount_pence: 1000000,
        current_amount_pence: 50000,
        monthly_contribution_pence: 25000,
        auto_contribute: 1,
        contribution_day: 5,
        is_household: 0,
      })
      .expect(201);

    await agent
      .post('/api/incomes')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Salary',
        amount_pence: 250000,
        posting_day: 25,
        is_recurring: true,
        recurrence_type: 'monthly',
        start_date: `${futureMonth}-01`,
      })
      .expect(201);

    const res = await agent.get(`/api/reports/upcoming-bills?month=${futureMonth}`).expect(200);
    const body = res.body as UpcomingBillsReportResponse;

    expect(body.month).toBe(futureMonth);
    expect(body.summary.total_count).toBe(3);
    expect(body.summary.total_pence).toBe(120000);
    expect(body.summary.past_due_count).toBe(0);
    expect(body.summary.due_today_count).toBe(0);

    expect(body.occurrences.map(item => [item.source, item.name, item.due_date, item.amount_pence])).toEqual([
      ['savings', 'Emergency Fund', `${futureMonth}-05`, 25000],
      ['debt', 'Credit Card', `${futureMonth}-12`, 35000],
      ['expense', 'Rent', `${futureMonth}-${lastDayOfMonth(futureMonth)}`, 60000],
    ]);
    expect(body.occurrences.every(item => item.status === 'upcoming')).toBe(true);
    expect(body.occurrences.some(item => item.name === 'Salary')).toBe(false);
  });

  it('clamps invalid stored savings contribution days when building due dates', async () => {
    const agent = await loginAgent('upcoming_savings_day_clamp');
    const csrf = await getCsrfToken(agent);
    const futureMonth = futureYearMonth(2);

    const lowGoalRes = await agent
      .post('/api/savings-goals')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Low Day Fund',
        target_amount_pence: 100000,
        monthly_contribution_pence: 10000,
        auto_contribute: 1,
        contribution_day: 1,
        is_household: 0,
      })
      .expect(201);

    const highGoalRes = await agent
      .post('/api/savings-goals')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'High Day Fund',
        target_amount_pence: 100000,
        monthly_contribution_pence: 20000,
        auto_contribute: 1,
        contribution_day: 28,
        is_household: 0,
      })
      .expect(201);

    db.prepare('UPDATE savings_goals SET contribution_day = ? WHERE id = ?')
      .run(0, (lowGoalRes.body as { id: string }).id);
    db.prepare('UPDATE savings_goals SET contribution_day = ? WHERE id = ?')
      .run(99, (highGoalRes.body as { id: string }).id);

    const res = await agent.get(`/api/reports/upcoming-bills?month=${futureMonth}`).expect(200);
    const body = res.body as UpcomingBillsReportResponse;
    const savingsDates = new Map(
      body.occurrences
        .filter(item => item.source === 'savings')
        .map(item => [item.name, item.due_date]),
    );

    expect(savingsDates.get('Low Day Fund')).toBe(`${futureMonth}-01`);
    expect(savingsDates.get('High Day Fund')).toBe(`${futureMonth}-28`);
  });

  it('labels current-month past dates as past due date without using overdue semantics', async () => {
    const agent = await loginAgent('upcoming_status');
    const csrf = await getCsrfToken(agent);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = now.getDate();
    const pastDay = Math.max(1, today - 1);

    await agent
      .post('/api/expenses')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Past Utility',
        amount_pence: 4000,
        posting_day: pastDay,
        category: 'Utilities',
        is_household: false,
        split_ratio: 1,
        is_recurring: true,
        recurrence_type: 'monthly',
        start_date: `${currentMonth}-01`,
      })
      .expect(201);

    await agent
      .post('/api/expenses')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Today Subscription',
        amount_pence: 900,
        posting_day: today,
        category: 'Subscriptions',
        is_household: false,
        split_ratio: 1,
        is_recurring: true,
        recurrence_type: 'monthly',
        start_date: `${currentMonth}-01`,
      })
      .expect(201);

    const res = await agent.get(`/api/reports/upcoming-bills?month=${currentMonth}`).expect(200);
    const body = res.body as UpcomingBillsReportResponse;
    const statuses = new Map(body.occurrences.map(item => [item.name, item.status]));

    expect(statuses.get('Past Utility')).toBe(today === 1 ? 'due_today' : 'past_due_date');
    expect(statuses.get('Today Subscription')).toBe('due_today');
  });
});
