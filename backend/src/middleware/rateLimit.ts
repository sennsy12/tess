import rateLimit from 'express-rate-limit';
import { Request } from 'express';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Rate limiting middleware configurations
 * All limiters are skipped in development mode
 */

// General API rate limit
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: () => isDevelopment,
});

// Strict rate limit for auth endpoints (prevent brute force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again in 15 minutes.' },
  skip: () => isDevelopment,
  // Using default keyGenerator (IP-based) to avoid IPv6 issues
});

// ETL rate limit (expensive operations)
export const etlLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 ETL operations per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ETL rate limit exceeded. Please wait before running more operations.' },
  skip: () => isDevelopment,
});

// Suggestions/search rate limit
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 searches per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Search rate limit exceeded. Please slow down.' },
  skip: () => isDevelopment,
});
