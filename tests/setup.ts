import { beforeAll } from 'vitest';

// Set test environment variables before any module imports
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test_secret_must_be_at_least_32_chars_long_ok';
process.env.TOTP_ENCRYPTION_KEY = '0'.repeat(64);
process.env.APP_URL = 'http://localhost:3001';
process.env.CORS_ORIGIN = 'http://localhost:5173';

// Use in-memory SQLite for tests
process.env.DB_PATH = ':memory:';

beforeAll(() => {
  // Ensure test environment is configured
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Tests must run with NODE_ENV=test');
  }
});
