import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;

/** A new random session token (256 bits, base64url). Sent to the browser in a cookie. */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * The session id stored in the database: a SHA-256 of the token. A leaked database therefore
 * does not contain usable session tokens.
 */
export function sessionIdFromToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
