/**
 * Simple token bucket rate limiter for client-side usage.
 * Allows up to `capacity` tokens within the rolling window (ms).
 * Tokens refill uniformly over time (lazy refill on each check).
 */
export class RateLimiter {
  private capacity: number;
  private tokens: number;
  private lastRefill: number;
  private readonly windowMs: number;

  constructor(options: { capacity: number; windowMs: number }) {
    this.capacity = options.capacity;
    this.tokens = options.capacity;
    this.windowMs = options.windowMs;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    const refillRate = this.capacity / this.windowMs; // tokens per ms
    const tokensToAdd = elapsed * refillRate;
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  tryRemove(tokens = 1): boolean {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  getRemaining(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * Debouncer helper returning a function that schedules execution after delay.
 * Subsequent calls reset the timer.
 */
export function createDebounce<T extends (...args: unknown[]) => void>(fn: T, delay: number) {
  let timer: number | undefined;
  return (...args: Parameters<T>) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}
