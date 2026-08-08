// ─────────────────────────────────────────────────────────────────────────────
// Landed — Zod Validation Middleware
// Validates request body/query/params against a Zod schema before the route
// handler runs. Fails fast with a clear 400 error on invalid input.
// ─────────────────────────────────────────────────────────────────────────────

import { z, type ZodSchema } from 'zod';
import type { Request, Response, NextFunction } from 'express';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Express middleware factory that validates a request property against a Zod schema.
 *
 * Usage:
 *   router.post('/jobs', validate('body', CreateJobSchema), handler);
 */
export function validate<T extends ZodSchema>(target: ValidationTarget, schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }
    // Replace the raw input with the parsed (and potentially transformed) value
    (req as unknown as Record<string, unknown>)[target] = result.data;
    next();
  };
}
