import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';

const CODE_COUNT = 10;
const CODE_LENGTH = 8;
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

function randomCode(): string {
  let code = '';
  // Rejection sampling to avoid modular bias if CHARSET length changes in future
  const limit = 256 - (256 % CHARSET.length);
  while (code.length < CODE_LENGTH) {
    const byte = randomBytes(1)[0];
    if (byte < limit) {
      code += CHARSET[byte % CHARSET.length];
    }
  }
  return code;
}

export function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < CODE_COUNT; i++) {
    codes.push(randomCode());
  }
  return codes;
}

export async function hashRecoveryCode(code: string): Promise<string> {
  return argon2.hash(code, { type: argon2.argon2id, memoryCost: 8192, timeCost: 1, parallelism: 1 });
}

export async function verifyRecoveryCode(code: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, code);
  } catch {
    return false;
  }
}
