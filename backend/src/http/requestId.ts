/**
 * Request-ID middleware: propagates `X-Request-Id` (or generates one)
 * so logs across controller → service → db can be correlated.
 *
 * Additive: sets `req.id` and the response header, never rejects.
 *
 * @module http/requestId
 */
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export interface RequestWithId extends Request {
  id?: string;
}

/** Header name shared by middleware and loggers. */
export const REQUEST_ID_HEADER = 'x-request-id';

export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction): void {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const id =
    (Array.isArray(incoming) ? incoming[0] : incoming)?.trim() || randomUUID();
  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
