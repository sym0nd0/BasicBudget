import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.issues[0];
      res.status(400).json({ message: first?.message ?? 'Validation error' });
      return;
    }
    req.body = result.data as Record<string, unknown>;
    next();
  };
}
