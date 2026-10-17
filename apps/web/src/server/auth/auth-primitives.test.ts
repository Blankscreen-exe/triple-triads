import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';
import { RateLimiter } from './rate-limiter';
import { generateSessionToken, sessionIdFromToken } from './session-token';

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('hunter22-hunter22');

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword(hash, 'hunter22-hunter22')).toBe(true);
    expect(await verifyPassword(hash, 'hunter22-hunter23')).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same-password')).not.toBe(await hashPassword('same-password'));
  });

  it('treats a malformed hash as a failed verification', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });
});

describe('session tokens', () => {
  it('are random and URL-safe', () => {
    const tokens = new Set(Array.from({ length: 100 }, generateSessionToken));

    expect(tokens.size).toBe(100);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hash to a stable id', () => {
    expect(sessionIdFromToken('abc')).toBe(sessionIdFromToken('abc'));
    expect(sessionIdFromToken('abc')).not.toBe(sessionIdFromToken('abd'));
  });
});

describe('RateLimiter', () => {
  const limiter = () => new RateLimiter({ maxAttempts: 2, windowMs: 1000 });

  it('blocks after the maximum number of attempts', () => {
    const rl = limiter();
    rl.recordAttempt('k', 0);
    rl.recordAttempt('k', 10);

    expect(rl.isAllowed('k', 20)).toBe(false);
    expect(rl.isAllowed('other', 20)).toBe(true);
  });

  it('allows attempts again once the window has passed', () => {
    const rl = limiter();
    rl.recordAttempt('k', 0);
    rl.recordAttempt('k', 0);

    expect(rl.isAllowed('k', 1000)).toBe(true);
  });

  it('can be reset, e.g. after a successful login', () => {
    const rl = limiter();
    rl.recordAttempt('k', 0);
    rl.recordAttempt('k', 0);
    rl.reset('k');

    expect(rl.isAllowed('k', 0)).toBe(true);
  });
});
