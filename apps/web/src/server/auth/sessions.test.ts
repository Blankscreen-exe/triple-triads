import { describe, expect, it } from 'vitest';
import { sessions } from '../db/schema';
import { createTestDatabase, createTestUser } from '../testing/test-database';
import {
  SESSION_DURATION_MS,
  createSession,
  deleteExpiredSessions,
  deleteSession,
  validateSessionToken,
} from './sessions';

describe('sessions', () => {
  it('validates a fresh session and returns its user', async () => {
    const db = createTestDatabase();
    const user = await createTestUser(db);

    const { token } = createSession(db, user.id);

    expect(validateSessionToken(db, token)).toEqual(user);
  });

  it('stores only a hash of the token', async () => {
    const db = createTestDatabase();
    const user = await createTestUser(db);

    const { token } = createSession(db, user.id);
    const [row] = db.select().from(sessions).all();

    expect(row?.id).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.id).not.toBe(token);
  });

  it('rejects unknown and expired tokens', async () => {
    const db = createTestDatabase();
    const user = await createTestUser(db);
    const start = new Date('2026-01-01T00:00:00Z');
    const { token } = createSession(db, user.id, start);

    expect(validateSessionToken(db, 'not-a-real-token')).toBeNull();
    expect(
      validateSessionToken(db, token, new Date(start.getTime() + SESSION_DURATION_MS)),
    ).toBeNull();
  });

  it('logs out by deleting the session', async () => {
    const db = createTestDatabase();
    const user = await createTestUser(db);
    const { token } = createSession(db, user.id);

    deleteSession(db, token);

    expect(validateSessionToken(db, token)).toBeNull();
  });

  it('cleans up expired sessions only', async () => {
    const db = createTestDatabase();
    const user = await createTestUser(db);
    const now = new Date('2026-06-01T00:00:00Z');
    createSession(db, user.id, new Date(now.getTime() - SESSION_DURATION_MS - 1));
    const { token: current } = createSession(db, user.id, now);

    expect(deleteExpiredSessions(db, now)).toBe(1);
    expect(validateSessionToken(db, current, now)).not.toBeNull();
  });
});
