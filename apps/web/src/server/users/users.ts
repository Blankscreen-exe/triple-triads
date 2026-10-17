/**
 * Registering and authenticating players.
 */
import { randomUUID } from 'node:crypto';
import { count, eq } from 'drizzle-orm';
import { usernameKey, type Credentials } from '@/lib/validation/credentials';
import { hashPassword, simulatePasswordVerification, verifyPassword } from '../auth/password';
import type { SessionUser } from '../auth/sessions';
import type { AppDatabase } from '../db/client';
import { users } from '../db/schema';
import { grantStarterDecks } from '../decks/decks';

export type RegisterResult =
  | { readonly ok: true; readonly user: SessionUser }
  | { readonly ok: false; readonly error: 'USERNAME_TAKEN' };

/**
 * Creates an account with every starter deck. The first account ever created becomes an admin,
 * so a fresh installation can be managed without extra setup.
 */
export async function registerUser(
  db: AppDatabase,
  { username, password }: Credentials,
): Promise<RegisterResult> {
  const key = usernameKey(username);
  if (findUserByKey(db, key)) return { ok: false, error: 'USERNAME_TAKEN' };

  // Hash before opening the transaction: it is slow and needs no database access.
  const passwordHash = await hashPassword(password);

  try {
    const user = db.transaction((tx): SessionUser => {
      const isFirstUser = (tx.select({ total: count() }).from(users).get()?.total ?? 0) === 0;
      const id = randomUUID();
      const role = isFirstUser ? 'admin' : 'player';
      const name = username.trim();

      tx.insert(users).values({ id, username: name, usernameKey: key, passwordHash, role }).run();
      const activeDeckId = grantStarterDecks(tx, id);
      if (activeDeckId) tx.update(users).set({ activeDeckId }).where(eq(users.id, id)).run();

      return { id, username: name, role };
    });
    return { ok: true, user };
  } catch (error) {
    // Another request registered the same name between the check above and the insert.
    if (isUniqueConstraintError(error)) return { ok: false, error: 'USERNAME_TAKEN' };
    throw error;
  }
}

export type AuthenticationResult =
  | { readonly ok: true; readonly user: SessionUser }
  | { readonly ok: false; readonly error: 'INVALID_CREDENTIALS' | 'BANNED' };

/**
 * Checks a username and password. A ban is only reported after the password is verified, so the
 * response never reveals anything about an account to someone without its password.
 */
export async function authenticateUser(
  db: AppDatabase,
  { username, password }: Credentials,
): Promise<AuthenticationResult> {
  const user = findUserByKey(db, usernameKey(username));
  if (!user) {
    await simulatePasswordVerification(password);
    return { ok: false, error: 'INVALID_CREDENTIALS' };
  }
  if (!(await verifyPassword(user.passwordHash, password))) {
    return { ok: false, error: 'INVALID_CREDENTIALS' };
  }
  if (user.bannedAt) return { ok: false, error: 'BANNED' };
  return { ok: true, user: { id: user.id, username: user.username, role: user.role } };
}

function findUserByKey(db: AppDatabase, key: string) {
  return db.select().from(users).where(eq(users.usernameKey, key)).get();
}

function isUniqueConstraintError(error: unknown): boolean {
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    if ('code' in current && current.code === 'SQLITE_CONSTRAINT_UNIQUE') return true;
  }
  return false;
}
