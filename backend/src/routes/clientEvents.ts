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

// Navngitte konstanter for tidligere inline magiske tall (samme grenser/oppførsel).
// Zod-meldinger beholdes (default-meldinger endres ikke av konstantnavn).
const MAX_EVENT_NAME_LENGTH = 128;
const MAX_EVENT_MESSAGE_LENGTH = 2048;
const MAX_EVENT_STACK_LENGTH = 8192;
const MAX_EVENT_RATING_LENGTH = 32;
const MAX_EVENT_PATH_LENGTH = 512;
const MAX_SESSION_ID_LENGTH = 64;
const MAX_RELEASE_LENGTH = 128;
const MAX_EVENTS_PER_BATCH = 100;

const eventSchema = z.object({
  type: z.enum(['error', 'vital', 'event']),
  name: z.string().max(MAX_EVENT_NAME_LENGTH),
  message: z.string().max(MAX_EVENT_MESSAGE_LENGTH).optional(),
  stack: z.string().max(MAX_EVENT_STACK_LENGTH).optional(),
  value: z.number().optional(),
  rating: z.string().max(MAX_EVENT_RATING_LENGTH).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  path: z.string().max(MAX_EVENT_PATH_LENGTH),
  ts: z.number(),
});

const payloadSchema = z.object({
  sessionId: z.string().max(MAX_SESSION_ID_LENGTH),
  release: z.string().max(MAX_RELEASE_LENGTH),
  events: z.array(eventSchema).max(MAX_EVENTS_PER_BATCH),
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
