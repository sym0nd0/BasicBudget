import { beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { getApp, getCsrfToken, makeTestUser, registerAndLoginDirect } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;

beforeAll(async () => {
  app = await getApp();
});

describe('recurring start date validation', () => {
  it('rejects weekly income creation without a start date', async () => {
    const agent = supertest.agent(app);
    await registerAndLoginDirect(agent, makeTestUser('weekly_income_missing_start'));
    const csrf = await getCsrfToken(agent);

    const res = await agent
      .post('/api/incomes')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Weekly Salary',
        amount_pence: 100000,
        posting_day: 1,
        gross_or_net: 'net',
        is_recurring: true,
        recurrence_type: 'weekly',
      });

    expect(res.status).toBe(400);
    expect((res.body as { message?: string }).message).toBe('Validation error');
  });

  it('rejects switching an expense to fortnightly without a start date', async () => {
    const agent = supertest.agent(app);
    await registerAndLoginDirect(agent, makeTestUser('fortnightly_expense_update'));

    let csrf = await getCsrfToken(agent);
    const createRes = await agent
      .post('/api/expenses')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Gym',
        amount_pence: 2500,
        posting_day: 1,
        category: 'Other',
        is_household: false,
        is_recurring: true,
        recurrence_type: 'monthly',
      });

    expect(createRes.status).toBe(201);
    const expenseId = (createRes.body as { id: string }).id;

    csrf = await getCsrfToken(agent);
    const updateRes = await agent
      .put(`/api/expenses/${expenseId}`)
      .set('X-CSRF-Token', csrf)
      .send({
        recurrence_type: 'fortnightly',
        start_date: null,
      });

    expect(updateRes.status).toBe(400);
    expect((updateRes.body as { message?: string }).message).toBe('Start date is required for weekly/fortnightly items');
  });

  it('rejects CSV import rows with weekly or fortnightly recurrence and no start date', async () => {
    const agent = supertest.agent(app);
    await registerAndLoginDirect(agent, makeTestUser('csv_missing_start'));
    const csrf = await getCsrfToken(agent);

    const expenseCsv = [
      'name,amount,day,category,household,split_ratio,account,recurrence_type,is_recurring,notes,start_date,end_date',
      'Groceries,50.00,1,Food & Groceries,no,1,,weekly,yes,Weekly shop,,',
    ].join('\n');
    const expenseRes = await agent
      .post('/api/import/csv')
      .set('X-CSRF-Token', csrf)
      .field('type', 'expenses')
      .attach('file', Buffer.from(expenseCsv), {
        filename: 'expenses.csv',
        contentType: 'text/csv',
      });

    expect(expenseRes.status).toBe(400);
    expect((expenseRes.body as { errors?: Array<{ message: string }> }).errors?.[0]?.message).toBe(
      'start_date is required for weekly/fortnightly rows'
    );

    const incomeCsv = [
      'name,amount,day,contributor,gross_or_net,recurrence_type,is_recurring,notes,start_date,end_date',
      'Contracting,500.00,5,,net,fortnightly,yes,Fortnightly payment,,',
    ].join('\n');
    const incomeRes = await agent
      .post('/api/import/csv')
      .set('X-CSRF-Token', csrf)
      .field('type', 'incomes')
      .attach('file', Buffer.from(incomeCsv), {
        filename: 'incomes.csv',
        contentType: 'text/csv',
      });

    expect(incomeRes.status).toBe(400);
    expect((incomeRes.body as { errors?: Array<{ message: string }> }).errors?.[0]?.message).toBe(
      'start_date is required for weekly/fortnightly rows'
    );
  });
});
