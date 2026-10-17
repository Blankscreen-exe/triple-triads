/**
 * Username and password rules. Shared by the server (authoritative validation) and the forms
 * (HTML constraints for instant feedback).
 */
import { z } from 'zod';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
/** Letters, digits, underscores and hyphens. */
export const USERNAME_PATTERN = '^[A-Za-z0-9_\-]+$';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const usernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN_LENGTH, `Username must be at least ${String(USERNAME_MIN_LENGTH)} characters.`)
  .max(USERNAME_MAX_LENGTH, `Username must be at most ${String(USERNAME_MAX_LENGTH)} characters.`)
  .regex(
    new RegExp(USERNAME_PATTERN),
    'Username may only contain letters, numbers, underscores and hyphens.',
  );

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${String(PASSWORD_MIN_LENGTH)} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${String(PASSWORD_MAX_LENGTH)} characters.`);

export const credentialsSchema = z.object({ username: usernameSchema, password: passwordSchema });

export type Credentials = z.infer<typeof credentialsSchema>;

/** The case-insensitive form used to keep usernames unique. */
export function usernameKey(username: string): string {
  return username.trim().toLowerCase();
}
