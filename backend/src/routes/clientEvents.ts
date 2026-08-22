/**
 * Client event ingestion (browser error/telemetry reports).
 *
 * The frontend observability layer batches events and POSTs them here
 * (sendBeacon → text/plain to avoid CORS preflight). There is no auth:
 * it must work for logged-out users hitting login-page crashes, carries
 * no PII, is strictly size-capped, and only logs — no persistence.
 *
 * @module routes/clientEvents
 */
import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger.js';

const clientEventsRouter = Router();

const eventSchema = z.object({
  type: z.enum(['error', 'vital', 'event']),
  name: z.string().max(128),
  message: z.string().max(2048).optional(),
  stack: z.string().max(8192).optional(),
  value: z.number().optional(),
  rating: z.string().max(32).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  path: z.string().max(512),
  ts: z.number(),
});

const payloadSchema = z.object({
  sessionId: z.string().max(64),
  release: z.string().max(128),
  events: z.array(eventSchema).max(100),
});

clientEventsRouter.post('/client-events', (req, res) => {
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid client events' });
    return;
  }
  const { sessionId, release, events } = parsed.data;
  for (const event of events) {
    // One structured log line per event; grep with `[client-event]`.
    logger.warn({ sessionId, release, clientEvent: event }, '[client-event] browser report');
  }
  // 204: sendBeacon ignores bodies; keep it cheap.
  res.status(204).end();
});

export { clientEventsRouter };
