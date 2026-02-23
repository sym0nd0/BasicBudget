import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { TOTP, Secret } from 'otpauth';
import QRCode from 'qrcode';
import { config } from '../config.js';

export interface EncryptedSecret {
  encrypted_secret: string; // hex
  iv: string;               // hex
  auth_tag: string;         // hex
}

export function generateTotpSecret(email: string): { totp: TOTP; base32: string } {
  const totp = new TOTP({
    issuer: 'BasicBudget',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });
  return { totp, base32: totp.secret.base32 };
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const key = Buffer.from(config.TOTP_ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted_secret: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    auth_tag: authTag.toString('hex'),
  };
}

export function decryptSecret(encrypted: string, iv: string, authTag: string): string {
  const key = Buffer.from(config.TOTP_ENCRYPTION_KEY, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function verifyTotp(base32Secret: string, token: string): boolean {
  const totp = new TOTP({
    secret: Secret.fromBase32(base32Secret),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

export async function generateQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}
