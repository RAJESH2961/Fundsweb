import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { UnprocessableError } from '../utils/errors';

export const validateRequest =
  (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(new UnprocessableError('Validation failed', errors));
    }
    req[source] = result.data;
    next();
  };
