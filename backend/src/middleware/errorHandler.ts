import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

/**
 * Base class for application errors
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
 * Global error handling middleware
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error details
  const errorContext = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: (req as any).user?.id,
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
 * Wrapper for async route handlers to catch errors and pass to next()
 */
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
