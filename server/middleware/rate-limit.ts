import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { logger } from '../services/logger.js';

function handleRateLimit(limitName: string, responseBody: { message: string } | string) {
  return (req: Request, res: Response): void => {
    logger.warn('Rate limit exceeded', {
      request_id: req.requestId,
      limiter: limitName,
      method: req.method,
      path: req.path,
      userId: req.userId,
      authenticated: Boolean(req.userId),
    });

    const body = typeof responseBody === 'string'
      ? { message: responseBody }
      : responseBody;
    res.status(429).json(body);
  };
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handleRateLimit(
    'loginLimiter',
    { message: 'Too many login attempts. Please try again in 15 minutes.' },
  ),
});

export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handleRateLimit(
    'otpLimiter',
    { message: 'Too many OTP attempts. Please try again in 15 minutes.' },
  ),
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handleRateLimit(
    'passwordResetLimiter',
    { message: 'Too many password reset requests. Please try again in an hour.' },
  ),
});

export const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handleRateLimit(
    'inviteLimiter',
    { message: 'Too many invite requests. Please try again in an hour.' },
  ),
});

export const totpResetLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handleRateLimit(
    'totpResetLimiter',
    { message: 'Too many 2FA reset requests. Please try again in 24 hours.' },
  ),
});

export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handleRateLimit(
    'registrationLimiter',
    { message: 'Too many registration attempts from this IP. Please try again later.' },
  ),
});

export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handleRateLimit(
    'generalApiLimiter',
    { message: 'Too many requests. Please slow down.' },
  ),
});

// Skip in test mode — backup/restore integration tests make more than 5 requests to these
// endpoints in a single run. All other limiters remain active in tests (security tests
// verify loginLimiter still triggers 429 as expected).
export const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: handleRateLimit(
    'sensitiveActionLimiter',
    { message: 'Too many attempts. Please try again in 15 minutes.' },
  ),
});

export const staticLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handleRateLimit('staticLimiter', 'Too many requests. Please slow down.'),
});

function getRateLimitKey(req: Request): string {
  const userId = (req as unknown as { userId?: string }).userId;
  return userId ?? req.ip ?? 'unknown';
}

export const backupStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getRateLimitKey(req),
  handler: handleRateLimit(
    'backupStatusLimiter',
    { message: 'Too many requests. Please slow down.' },
  ),
});

export const backupConfigWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getRateLimitKey(req),
  skip: () => process.env.NODE_ENV === 'test',
  handler: handleRateLimit(
    'backupConfigWriteLimiter',
    { message: 'Too many backup configuration changes. Please try again in 15 minutes.' },
  ),
});
