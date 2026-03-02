import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../../server/auth/password.js';

describe('password hashing', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('TestPass1!');
    expect(await verifyPassword(hash, 'TestPass1!')).toBe(true);
    expect(await verifyPassword(hash, 'WrongPass1')).toBe(false);
  });

  it('produces different hashes for the same password', async () => {
    const h1 = await hashPassword('TestPass1!');
    const h2 = await hashPassword('TestPass1!');
    expect(h1).not.toBe(h2);
  });
});

describe('validatePasswordStrength', () => {
  it('rejects passwords under 8 chars', () => {
    expect(validatePasswordStrength('Ab1!').valid).toBe(false);
  });
  it('rejects passwords without uppercase', () => {
    expect(validatePasswordStrength('testpass1!').valid).toBe(false);
  });
  it('rejects passwords without lowercase', () => {
    expect(validatePasswordStrength('TESTPASS1!').valid).toBe(false);
  });
  it('rejects passwords without digits', () => {
    expect(validatePasswordStrength('TestPasswd!').valid).toBe(false);
  });
  it('rejects passwords without special characters', () => {
    expect(validatePasswordStrength('TestPass1').valid).toBe(false);
  });
  it('accepts valid passwords', () => {
    expect(validatePasswordStrength('TestPass1!').valid).toBe(true);
  });
});
