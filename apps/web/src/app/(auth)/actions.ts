'use server';

import { redirect } from 'next/navigation';
import { credentialsSchema, usernameKey } from '@/lib/validation/credentials';
import { RateLimiter } from '@/server/auth/rate-limiter';
import { createSession, deleteSession } from '@/server/auth/sessions';
import { getDatabase } from '@/server/db';
import { authenticateUser, registerUser } from '@/server/users/users';
import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
} from '@/server/web/session-cookie';

export interface AuthFormState {
  readonly error: string | null;
  /** Echoed back so the form keeps what the user typed after an error. */
  readonly username: string;
}

/** Five failed logins per username per 15 minutes. */
const loginThrottle = new RateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 });

export async function signUp(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const input = readCredentials(formData);
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.', username: input.username };
  }

  const db = getDatabase();
  const result = await registerUser(db, parsed.data);
  if (!result.ok) {
    return { error: 'That username is already taken.', username: input.username };
  }

  await startSession(result.user.id);
  redirect('/');
}

export async function logIn(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const input = readCredentials(formData);
  const parsed = credentialsSchema.safeParse(input);
  // Deliberately vague: do not reveal which part was wrong.
  const failure = { error: 'Wrong username or password.', username: input.username };
  if (!parsed.success) return failure;

  const throttleKey = usernameKey(parsed.data.username);
  if (!loginThrottle.isAllowed(throttleKey)) {
    return {
      error: 'Too many failed attempts. Please wait a few minutes and try again.',
      username: input.username,
    };
  }

  const result = await authenticateUser(getDatabase(), parsed.data);
  if (!result.ok) {
    if (result.error === 'BANNED') {
      return { error: 'This account has been suspended.', username: input.username };
    }
    loginThrottle.recordAttempt(throttleKey);
    return failure;
  }

  loginThrottle.reset(throttleKey);
  await startSession(result.user.id);
  redirect('/');
}

export async function logOut(): Promise<void> {
  const token = await readSessionToken();
  if (token) deleteSession(getDatabase(), token);
  await clearSessionCookie();
  redirect('/');
}

async function startSession(userId: string): Promise<void> {
  const { token, expiresAt } = createSession(getDatabase(), userId);
  await setSessionCookie(token, expiresAt);
}

function readCredentials(formData: FormData) {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
  };
  return { username: field('username'), password: field('password') };
}
