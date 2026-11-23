import { HttpError } from './http.js';
import { logger } from './logger.js';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries: number; baseMs?: number; label: string },
): Promise<T> {
  const base = opts.baseMs ?? 2000;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const nonRetryable = err instanceof HttpError && !err.retryable;
      if (nonRetryable || attempt > opts.retries) throw err;
      const delay =
        err instanceof HttpError && err.retryAfterMs
          ? err.retryAfterMs
          : base * 2 ** (attempt - 1) + Math.random() * 500;
      logger.warn(`${opts.label} gagal (percobaan ${attempt}/${opts.retries}): ${(err as Error).message}. Retry ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }
}
