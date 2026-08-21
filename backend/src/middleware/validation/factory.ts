import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';
import { ValidationError } from '../errorHandler.js';

/**
 * Validation middleware factory
 * Creates middleware that validates request body, query, or params against a Zod schema
 */
export const validate = <T extends ZodSchema>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      // Replace with validated/transformed data
      req[source] = data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.issues.map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new ValidationError(`Validation failed: ${messages}`);
      }
      throw error;
    }
  };
};
