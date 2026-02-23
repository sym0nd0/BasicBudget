import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),

  // Database
  DB_PATH: z.string().optional(),

  // Session
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),

  // TOTP encryption — 64 hex chars = 32 bytes for AES-256-GCM
  TOTP_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'TOTP_ENCRYPTION_KEY must be exactly 64 hex characters'),

  // Application URLs
  APP_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

});

// In test environment, provide safe defaults for required fields
function buildEnv() {
  if (process.env.NODE_ENV === 'test') {
    process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'test_secret_at_least_32_chars_long_ok';
    process.env.TOTP_ENCRYPTION_KEY =
      process.env.TOTP_ENCRYPTION_KEY ?? '0'.repeat(64);
  }

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment configuration:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const config = buildEnv();
