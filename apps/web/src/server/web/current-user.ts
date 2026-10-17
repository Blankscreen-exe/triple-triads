/**
 * Data access layer entry point for "who is making this request?". Every page, component and
 * server action that needs the user goes through here.
 */
import 'server-only';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';
import { validateSessionToken, type SessionUser } from '../auth/sessions';
import { getDatabase } from '../db';
import { readSessionToken } from './session-cookie';

/** The signed-in user, or null. Deduplicated within a request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  // Session validity depends on the current time, so this must run per request, never prerendered.
  await connection();
  return validateSessionToken(getDatabase(), token);
});

/** The signed-in user; redirects to the login page if there is none. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}
