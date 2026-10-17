/**
 * In-memory fixed-window rate limiter, used to slow down password guessing.
 *
 * State lives in the process, which is fine for this single-instance, self-hosted app. Running
 * several instances would need a shared store instead.
 */
export interface RateLimiterOptions {
  readonly maxAttempts: number;
  readonly windowMs: number;
}

interface Window {
  count: number;
  resetsAt: number;
}

export class RateLimiter {
  readonly #windows = new Map<string, Window>();

  constructor(private readonly options: RateLimiterOptions) {}

  /** True while `key` still has attempts left in the current window. */
  isAllowed(key: string, now = Date.now()): boolean {
    const window = this.#activeWindow(key, now);
    return window === undefined || window.count < this.options.maxAttempts;
  }

  recordAttempt(key: string, now = Date.now()): void {
    const window = this.#activeWindow(key, now);
    if (window) {
      window.count++;
    } else {
      this.#windows.set(key, { count: 1, resetsAt: now + this.options.windowMs });
    }
  }

  reset(key: string): void {
    this.#windows.delete(key);
  }

  #activeWindow(key: string, now: number): Window | undefined {
    const window = this.#windows.get(key);
    if (window && window.resetsAt <= now) {
      this.#windows.delete(key);
      return undefined;
    }
    return window;
  }
}
