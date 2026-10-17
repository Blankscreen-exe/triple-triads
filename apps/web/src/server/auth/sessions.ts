/**
 * Database-backed login sessions.
 */
import { and, eq, gt, lte } from 'drizzle-orm';
import type { AppDatabase } from '../db/client';
import { sessions, users, type UserRole } from '../db/schema';
import { generateSessionToken, sessionIdFromToken } from './session-token';

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  readonly id: string;
  readonly username: string;
  readonly role: UserRole;
}

export interface CreatedSession {
  /** Secret token for the cookie. Not stored anywhere on the server. */
  readonly token: string;
  readonly expiresAt: Date;
}

export function createSession(db: AppDatabase, userId: string, now = new Date()): CreatedSession {
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  db.insert(sessions)
    .values({ id: sessionIdFromToken(token), userId, expiresAt, createdAt: now })
    .run();
  return { token, expiresAt };
}

/** Returns the session's user, or null if the token is unknown or expired. */
export function validateSessionToken(
  db: AppDatabase,
  token: string,
  now = new Date(),
): SessionUser | null {
  const row = db
    .select({ id: users.id, username: users.username, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionIdFromToken(token)), gt(sessions.expiresAt, now)))
    .get();
  return row ?? null;
}

export function deleteSession(db: AppDatabase, token: string): void {
  db.delete(sessions)
    .where(eq(sessions.id, sessionIdFromToken(token)))
    .run();
}

export function deleteExpiredSessions(db: AppDatabase, now = new Date()): number {
  return db.delete(sessions).where(lte(sessions.expiresAt, now)).run().changes;
}
