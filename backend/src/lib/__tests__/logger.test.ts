/**
 * Logger redaction: secrets must never reach log output, even when a
 * caller logs a whole config/request object.
 */
import pino from 'pino';
import { loggerRedactPaths } from '../logger';

function loggedOutput(obj: Record<string, unknown>): string {
  let out = '';
  const stream = {
    write: (chunk: string) => {
      out += chunk;
    },
  };
  const testLogger = pino(
    { redact: { paths: loggerRedactPaths, censor: '[REDACTED]' } },
    stream as unknown as NodeJS.WritableStream,
  );
  testLogger.info(obj, 'test event');
  return out;
}

describe('logger redaction', () => {
  it('redacts top-level and nested secrets', () => {
    const out = loggedOutput({
      username: 'admin',
      password: 'super-secret',
      nested: { DATABASE_URL: 'postgresql://x:y@host/db', ok: 1 },
    });
    expect(out).not.toContain('super-secret');
    expect(out).not.toContain('postgresql://x:y@host/db');
    expect(out).toContain('admin');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts authorization headers', () => {
    const out = loggedOutput({ authorization: 'Bearer abc123' });
    expect(out).not.toContain('abc123');
  });
});
