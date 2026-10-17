/**
 * Password hashing with Argon2id, using the OWASP-recommended minimum parameters
 * (19 MiB memory, 2 iterations, 1 degree of parallelism).
 *
 * Argon2id is the library's default algorithm; tests assert the hashes use it.
 */
import { hash, verify } from '@node-rs/argon2';

const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // A malformed hash is a failed verification, not a crash.
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Spends the same time as a real verification. Called when a login names an unknown user, so
 * response times do not reveal which usernames exist.
 */
export async function simulatePasswordVerification(password: string): Promise<void> {
  dummyHash ??= hashPassword('timing-equalisation-placeholder');
  await verifyPassword(await dummyHash, password);
}
