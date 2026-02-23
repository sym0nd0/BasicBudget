import { describe, it, expect } from 'vitest';
import { generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCode } from '../../server/auth/recovery-codes.js';

describe('recovery codes', () => {
  it('generates 10 codes', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(codes.every(c => c.length === 8)).toBe(true);
  });

  it('all codes are unique', () => {
    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
  });

  it('hash and verify roundtrip works', async () => {
    const code = 'ABCD1234';
    const hash = await hashRecoveryCode(code);
    expect(await verifyRecoveryCode(code, hash)).toBe(true);
    expect(await verifyRecoveryCode('WRONG123', hash)).toBe(false);
  });
});
