export const isRetryableError = (error: any): boolean => {
  const msg = (error?.message ?? '').toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('upstream') ||
    msg.includes('schema cache') ||
    msg.includes('querying schema') ||
    msg.includes('unavailable') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('502') ||
    error?.name === 'AbortError' ||
    error?.code === '57014' ||
    error?.status === 504 ||
    error?.status === 503 ||
    error?.status === 502
  );
};

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  capMs: number;
  jitterMs: number;
  onRetry?: (attempt: number, delayMs: number, error: any) => void;
}

export const withRetry = async <T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions
): Promise<T> => {
  const { maxAttempts, baseDelayMs, capMs, jitterMs, onRetry } = options;
  const jitter = () => Math.floor(Math.random() * jitterMs);
  const backoff = (n: number) => Math.min(baseDelayMs * Math.pow(2, n - 1) + jitter(), capMs);

  let lastError: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error: any) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxAttempts) break;
      const delay = backoff(attempt);
      onRetry?.(attempt, delay, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};
