import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { TOTP } from 'otpauth';
import { getApp, makeTestUser } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;

beforeAll(async () => {
  app = await getApp();
});

async function csrfToken(agent: ReturnType<typeof supertest.agent>): Promise<string> {
  const r = await agent.get('/api/auth/csrf-token');
  return (r.body as { token?: string }).token ?? '';
}

async function registerAndLogin(app: Awaited<ReturnType<typeof getApp>>, suffix: string) {
  const agent = supertest.agent(app);
  const user = makeTestUser(suffix);
  let csrf = await csrfToken(agent);
  await agent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: user.email, password: user.password });
  csrf = await csrfToken(agent);
  await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email: user.email, password: user.password });
  return { agent, user };
}

describe('TOTP flow', () => {
  it('rejects OTP verify-setup without prior setup', async () => {
    const { agent } = await registerAndLogin(app, 'totp_nosetup');
    const csrf = await csrfToken(agent);
    const res = await agent
      .post('/api/auth/totp/verify-setup')
      .set('X-CSRF-Token', csrf)
      .send({ token: '000000' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid OTP token during verify-setup', async () => {
    const { agent } = await registerAndLogin(app, 'totp_invalid');

    // First verify email (mock)
    const db = (await import('../../server/db.js')).default;
    const userRow = db.prepare("SELECT id FROM users WHERE email LIKE 'test%totp_invalid%'").get() as { id: string } | undefined;
    if (userRow) db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(userRow.id);

    let csrf = await csrfToken(agent);
    const setupRes = await agent.post('/api/auth/totp/setup').set('X-CSRF-Token', csrf).send({});
    expect(setupRes.status).toBe(200);

    csrf = await csrfToken(agent);
    const verifyRes = await agent
      .post('/api/auth/totp/verify-setup')
      .set('X-CSRF-Token', csrf)
      .send({ token: '000000' });
    expect(verifyRes.status).toBe(400);
  });
});
