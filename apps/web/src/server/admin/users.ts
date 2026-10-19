/**
 * User management for admins (design/SPEC.md, section 11).
 *
 * Guard rails: admins cannot act on their own account here, an admin must be demoted before being
 * banned, and the last remaining admin cannot be demoted.
 */
import { randomBytes } from 'node:crypto';
import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import { loadPage, type Page, type PageRequest } from '@/lib/pagination';
import { usernameKey } from '@/lib/validation/credentials';
import { hashPassword } from '../auth/password';
import { deleteUserSessions } from '../auth/sessions';
import type { AppDatabase } from '../db/client';
import { users, type UserRole } from '../db/schema';

export interface AdminUserRow {
  readonly id: string;
  readonly username: string;
  readonly role: UserRole;
  readonly rating: number;
  readonly gamesPlayed: number;
  readonly createdAt: Date;
  readonly bannedAt: Date | null;
}

export type UserAdminError =
  'USER_NOT_FOUND' | 'CANNOT_CHANGE_SELF' | 'ADMIN_CANNOT_BE_BANNED' | 'LAST_ADMIN';

export type UserAdminResult<T = null> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: UserAdminError };

/** One page of the accounts, by username; `search` keeps those whose name contains it. */
export function listUsers(
  db: AppDatabase,
  { page, pageSize }: PageRequest,
  search = '',
): Page<AdminUserRow> {
  const key = usernameKey(search);
  // instr, unlike LIKE, needs no escaping of the search text.
  const matches = key === '' ? undefined : sql`instr(${users.usernameKey}, ${key}) > 0`;
  const total = db.select({ total: count() }).from(users).where(matches).get()?.total ?? 0;
  return loadPage(total, page, pageSize, (offset, limit) =>
    db
      .select()
      .from(users)
      .where(matches)
      .orderBy(asc(users.usernameKey))
      .limit(limit)
      .offset(offset)
      .all()
      .map((user) => ({
        id: user.id,
        username: user.username,
        role: user.role,
        rating: user.rating,
        gamesPlayed: user.wins + user.losses + user.draws,
        createdAt: user.createdAt,
        bannedAt: user.bannedAt,
      })),
  );
}

/** Sets a new random password, logs the user out everywhere, and returns the password once. */
export async function resetPassword(
  db: AppDatabase,
  actorId: string,
  userId: string,
): Promise<UserAdminResult<{ password: string }>> {
  if (actorId === userId) return { ok: false, error: 'CANNOT_CHANGE_SELF' };
  if (!findUser(db, userId)) return { ok: false, error: 'USER_NOT_FOUND' };

  // 12 URL-safe characters (72 bits of randomness): easy to pass on, hard to guess.
  const password = randomBytes(9).toString('base64url');
  const passwordHash = await hashPassword(password);
  db.transaction((tx) => {
    tx.update(users).set({ passwordHash }).where(eq(users.id, userId)).run();
    deleteUserSessions(tx, userId);
  });
  return { ok: true, data: { password } };
}

export function setBanned(
  db: AppDatabase,
  actorId: string,
  userId: string,
  banned: boolean,
): UserAdminResult {
  if (actorId === userId) return { ok: false, error: 'CANNOT_CHANGE_SELF' };
  const user = findUser(db, userId);
  if (!user) return { ok: false, error: 'USER_NOT_FOUND' };
  if (banned && user.role === 'admin') return { ok: false, error: 'ADMIN_CANNOT_BE_BANNED' };

  db.transaction((tx) => {
    tx.update(users)
      .set({ bannedAt: banned ? new Date() : null })
      .where(eq(users.id, userId))
      .run();
    if (banned) deleteUserSessions(tx, userId);
  });
  return { ok: true, data: null };
}

export function setRole(
  db: AppDatabase,
  actorId: string,
  userId: string,
  role: UserRole,
): UserAdminResult {
  if (actorId === userId) return { ok: false, error: 'CANNOT_CHANGE_SELF' };
  const user = findUser(db, userId);
  if (!user) return { ok: false, error: 'USER_NOT_FOUND' };

  if (user.role === 'admin' && role !== 'admin') {
    const admins =
      db
        .select({ total: count() })
        .from(users)
        .where(and(eq(users.role, 'admin'), isNull(users.bannedAt)))
        .get()?.total ?? 0;
    if (admins <= 1) return { ok: false, error: 'LAST_ADMIN' };
  }
  db.update(users).set({ role }).where(eq(users.id, userId)).run();
  return { ok: true, data: null };
}

function findUser(db: AppDatabase, userId: string) {
  return db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .get();
}
