import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { getApp, getCsrfToken, makeTestUser, registerAndLoginDirect } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;

beforeAll(async () => {
  app = await getApp();
});

describe('CSV import', () => {
  it('skips only exact duplicate expenses and imports rows that differ by schedule/category/account', async () => {
    const agent = supertest.agent(app);
    await registerAndLoginDirect(agent, makeTestUser('import_expenses'));

    let csrf = await getCsrfToken(agent);
    const accountRes = await agent
      .post('/api/accounts')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Main Current Account', sort_order: 1, is_joint: false });
    expect(accountRes.status).toBe(201);

    const csv = [
      'name,amount,day,category,household,split_ratio,account,recurrence_type,is_recurring,notes,start_date,end_date',
      'Internet,50.00,1,Utilities,no,1,Main Current Account,monthly,yes,Primary broadband,2026-01-01,',
      'Internet,50.00,15,Utilities,no,1,Main Current Account,monthly,yes,Primary broadband,2026-01-01,',
      'Internet,50.00,1,Other,no,1,Main Current Account,monthly,yes,Primary broadband,2026-01-01,',
      'Internet,50.00,1,Utilities,no,1,,monthly,yes,Primary broadband,2026-01-01,',
      'Internet,50.00,1,Utilities,no,1,Main Current Account,monthly,yes,Primary broadband,2026-01-01,',
    ].join('\n');

    csrf = await getCsrfToken(agent);
    const importRes = await agent
      .post('/api/import/csv')
      .set('X-CSRF-Token', csrf)
      .field('type', 'expenses')
      .attach('file', Buffer.from(csv), {
        filename: 'expenses.csv',
        contentType: 'text/csv',
      });

    expect(importRes.status).toBe(200);
    expect(importRes.body).toMatchObject({
      imported: 4,
      skipped: 1,
    });

    const expensesRes = await agent.get('/api/expenses');
    expect(expensesRes.status).toBe(200);
    const expenses = expensesRes.body as Array<{
      name: string;
      amount_pence: number;
      posting_day: number;
      category: string;
      account_id: string | null;
    }>;
    const importedInternetRows = expenses.filter(expense =>
      expense.name === 'Internet' && expense.amount_pence === 5000
    );
    expect(importedInternetRows).toHaveLength(4);
    expect(importedInternetRows.map(expense => expense.posting_day).sort((a, b) => a - b)).toEqual([1, 1, 1, 15]);
    expect(importedInternetRows.some(expense => expense.category === 'Other')).toBe(true);
    expect(importedInternetRows.some(expense => expense.account_id === null)).toBe(true);
  });
});
