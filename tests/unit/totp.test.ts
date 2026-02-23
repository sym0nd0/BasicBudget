import { describe, it, expect } from 'vitest';
import { generateTotpSecret, encryptSecret, decryptSecret, verifyTotp } from '../../server/auth/totp.js';

describe('TOTP', () => {
  it('generates a TOTP secret with base32', () => {
    const { base32 } = generateTotpSecret('test@example.com');
    expect(typeof base32).toBe('string');
    expect(base32.length).toBeGreaterThan(0);
  });

  it('encrypt/decrypt roundtrip works', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const { encrypted_secret, iv, auth_tag } = encryptSecret(plaintext);
    const decrypted = decryptSecret(encrypted_secret, iv, auth_tag);
    expect(decrypted).toBe(plaintext);
  });

  it('verifyTotp rejects an invalid token', () => {
    const { base32 } = generateTotpSecret('test@example.com');
    expect(verifyTotp(base32, '000000')).toBe(false);
  });
});
