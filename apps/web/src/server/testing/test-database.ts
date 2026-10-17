/**
 * Test helpers: a fresh in-memory database with the real migrations applied.
 */
import { seedStarterContent } from '../catalog/seed';
import { migrateDatabase, openDatabase, type AppDatabase } from '../db/client';
import { registerUser } from '../users/users';

export function createTestDatabase({ seed = true } = {}): AppDatabase {
  const db = openDatabase(':memory:');
  migrateDatabase(db);
  if (seed) seedStarterContent(db);
  return db;
}

export async function createTestUser(db: AppDatabase, username = 'player') {
  const result = await registerUser(db, { username, password: 'correct horse battery' });
  if (!result.ok) throw new Error(`Could not create test user: ${result.error}`);
  return result.user;
}
