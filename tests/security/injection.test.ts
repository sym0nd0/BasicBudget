import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { getApp } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;

beforeAll(async () => {
  app = await getApp();
});

async function csrfToken(agent: ReturnType<typeof supertest.agent>): Promise<string> {
  const r = await agent.get('/api/auth/csrf-token');
  return (r.body as { token?: string }).token ?? '';
}

describe('SQL injection', () => {
  it('email with SQL injection does not break login', async () => {
    const agent = supertest.agent(app);
    const csrf = await csrfToken(agent);
    const res = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrf)
      .send({ email: "' OR 1=1; --", password: 'anything' });
    // Should return 400 (invalid email format) or 401 (not found), never 200
    expect([400, 401]).toContain(res.status);
  });

  it('SQL injection in query params does not expose data', async () => {
    const agent = supertest.agent(app);
    const res = await agent.get("/api/incomes?month=2024-01' OR '1'='1");
    // Should be 401 (unauthenticated), not 200 with all data
    expect(res.status).toBe(401);
  });
});
