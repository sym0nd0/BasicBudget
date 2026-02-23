import { describe, it, expect, beforeEach } from 'vitest';

// Tokens module uses db which is a singleton — reset in-memory db between tests
describe('tokens', () => {
  let createToken: typeof import('../../server/auth/tokens.js').createToken;
  let validateAndConsumeToken: typeof import('../../server/auth/tokens.js').validateAndConsumeToken;
  let db: typeof import('../../server/db.js').default;

  beforeEach(async () => {
    // Fresh module imports per test group
    const dbMod = await import('../../server/db.js');
    db = dbMod.default;
    const tokenMod = await import('../../server/auth/tokens.js');
    createToken = tokenMod.createToken;
    validateAndConsumeToken = tokenMod.validateAndConsumeToken;

    // Create a test user
    db.prepare("INSERT OR IGNORE INTO users (id, email, display_name) VALUES ('u1', 'tokentest@example.com', 'Test')").run();
    db.prepare("INSERT OR IGNORE INTO households (id, name) VALUES ('h1', 'Test Household')").run();
  });

  it('create and consume a token', () => {
    const raw = createToken('u1', 'password_reset');
    const result = validateAndConsumeToken(raw, 'password_reset');
    expect(result).not.toBeNull();
    expect(result?.userId).toBe('u1');
  });

  it('cannot consume a token twice', () => {
    const raw = createToken('u1', 'password_reset');
    validateAndConsumeToken(raw, 'password_reset');
    const result2 = validateAndConsumeToken(raw, 'password_reset');
    expect(result2).toBeNull();
  });

  it('rejects wrong token type', () => {
    const raw = createToken('u1', 'password_reset');
    const result = validateAndConsumeToken(raw, 'email_verify');
    expect(result).toBeNull();
  });

  it('rejects invalid token', () => {
    const result = validateAndConsumeToken('notarealtoken', 'password_reset');
    expect(result).toBeNull();
  });
});
