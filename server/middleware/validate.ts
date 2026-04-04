import type { Request, Response, NextFunction } from 'express';
import type { ZodIssue, ZodSchema } from 'zod';
import { logger } from '../services/logger.js';

export function logValidationFailure(req: Request, issues: readonly ZodIssue[], context?: string): void {
  logger.warn('Request validation failed', {
    request_id: req.requestId,
    method: req.method,
    path: req.path,
    context,
    issues: issues.map(issue => ({
      path: issue.path.join('.'),
      code: issue.code,
      message: issue.message,
    })),
  });
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.issues[0];
      logValidationFailure(req, result.error.issues, 'request_body');
      res.status(400).json({ message: first?.message ?? 'Validation error' });
      return;
    }
    req.body = result.data as Record<string, unknown>;
    next();
  };
}
