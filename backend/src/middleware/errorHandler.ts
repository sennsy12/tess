/**
 * Error Handling Middleware & Utilities
 *
 * Provides a hierarchy of typed application errors and a centralised
 * Express error-handling middleware that serialises them into consistent
 * JSON responses. Also includes the `asyncHandler` wrapper that
 * eliminates try/catch boilerplate in async route handlers.
 *
 * Feil-envelope er kanonisk `{ status: 'error', error: <melding> }` (HTTP-kode beholdes).
 * Direkte `res.status(...).json({ error })`-svar uten `status`-felt normaliseres
 * bakoverkompatibelt ved å LEGGE TIL `status: 'error'` — aldri fjerne felt.
 *
 * P1 (utsatt til senere major, ikke breaking her): suksess-envelope er inkonsistent
 * på tvers av kontrollere (`{ data }` vs `{ success, data }` vs rå arrays/objekter,
 * f.eks. dashboard/status vs report). Ikke endret her — krever frontend-avklaring.
 *
 * @module middleware/errorHandler
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

/**
 * Base class for operational application errors.
 *
 * Subclasses set a specific HTTP status code so the global error
 * handler can respond appropriately without a switch statement.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error for validation failures (400)
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, 400);
  }
}

/**
 * Error for resource not found (404)
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * Error for authentication failures (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * Error for authorization failures (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * Error for version conflicts / duplicate writes (409)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409);
  }
}

/**
 * Error for rate-limit exhaustion (429)
 */
export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}

/**
 * Error for downstream outages (503) — fail closed, retryable.
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503);
  }
}

/**
 * Global error handling middleware
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log error details
  // requestId is set by requestIdMiddleware — read defensively and omit when
  // absent so error logging itself can never throw.
  const requestId = (req as unknown as { id?: unknown }).id;
  const errorContext = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: (req as any).user?.id,
    ...(typeof requestId === 'string' && requestId.length > 0 ? { requestId } : {}),
  };

  if (err instanceof AppError) {
    // Operational errors (expected)
    if (err.statusCode >= 500) {
      logger.error({ ...errorContext, error: err.message, stack: err.stack }, 'Operational server error');
    } else {
      logger.warn({ ...errorContext, error: err.message }, 'Client error');
    }
    return res.status(err.statusCode).json({
      status: 'error',
      error: err.message,
    });
  }

  // Handle Postgres errors
  if ((err as any).code === '23505') {
    logger.warn({ ...errorContext, error: 'Duplicate entry' }, 'Database constraint violation');
    return res.status(409).json({
      status: 'error',
      error: 'Duplicate entry already exists',
    });
  }

  if ((err as any).code === '23503') {
    logger.warn({ ...errorContext, error: 'Foreign key constraint' }, 'Database constraint violation');
    return res.status(400).json({
      status: 'error',
      error: 'Related record not found (Foreign key constraint)',
    });
  }

  // Default to 500 for unhandled errors (programming errors)
  logger.error({ ...errorContext, error: err.message, stack: err.stack }, 'Unhandled error');
  
  res.status(500).json({
    status: 'error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Wraps an async Express handler so that rejected promises are
 * automatically forwarded to `next()` (the global error handler).
 *
 * Eliminates the need for try/catch in every route.
 *
 * @example
 * ```ts
 * router.get('/foo', asyncHandler(async (req, res) => {
 *   const data = await fetchData(); // errors forwarded automatically
 *   res.json(data);
 * }));
 * ```
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => unknown
) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
