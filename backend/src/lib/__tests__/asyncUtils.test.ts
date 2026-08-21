import { withRetry, withTimeout, isTransientError } from '../asyncUtils.js';
import { AppError } from '../../middleware/errorHandler.js';

describe('asyncUtils', () => {
  describe('withTimeout', () => {
    it('resolves when promise completes in time', async () => {
      await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42);
    });

    it('rejects when promise exceeds timeout', async () => {
      const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 200));
      await expect(withTimeout(slow as Promise<string>, 50, 'Test')).rejects.toThrow('Test timed out');
    });
  });

  describe('withRetry', () => {
    it('retries until success', async () => {
      let calls = 0;
      const result = await withRetry(async () => {
        calls += 1;
        if (calls < 3) throw new TypeError('Failed to fetch');
        return 'ok';
      }, { attempts: 3, backoffMs: 1 });

      expect(result).toBe('ok');
      expect(calls).toBe(3);
    });

    it('throws after exhausting attempts', async () => {
      await expect(
        withRetry(async () => {
          throw new Error('always fails');
        }, { attempts: 2, backoffMs: 1 }),
      ).rejects.toThrow('always fails');
    });

    it('does not retry non-transient AppError', async () => {
      let calls = 0;
      await expect(
        withRetry(async () => {
          calls += 1;
          throw new AppError('bad request', 400);
        }, { attempts: 3, backoffMs: 1 }),
      ).rejects.toThrow('bad request');
      expect(calls).toBe(1);
    });
  });

  describe('isTransientError', () => {
    it('treats retryable HTTP statuses as transient', () => {
      expect(isTransientError(new AppError('rate limited', 429))).toBe(true);
      expect(isTransientError(new AppError('bad request', 400))).toBe(false);
    });

    it('treats network TypeError as transient', () => {
      expect(isTransientError(new TypeError('Failed to fetch'))).toBe(true);
    });
  });
});
