/**
 * Database work done once when the server starts.
 */
import { count } from 'drizzle-orm';
import { deleteExpiredSessions } from '../auth/sessions';
import { seedStarterContent } from '../catalog/seed';
import type { Logger } from '../logger';
import { migrateDatabase, openDatabase, type AppDatabase } from './client';
import { users } from './schema';

const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

/** Opens the database, applies pending migrations and inserts first-run content. */
export function prepareDatabase(databasePath: string, logger: Logger): AppDatabase {
  const db = openDatabase(databasePath);
  migrateDatabase(db);
  logger.info({ databasePath }, 'database ready');

  if (seedStarterContent(db)) logger.info('inserted default cards and starter decks');

  const userCount = db.select({ total: count() }).from(users).get()?.total ?? 0;
  if (userCount === 0) {
    logger.warn('no accounts yet: the first account to sign up becomes the admin');
  }
  return db;
}

/** Periodically removes expired sessions. Returns a function that stops the job. */
export function scheduleSessionCleanup(db: AppDatabase, logger: Logger): () => void {
  const timer = setInterval(() => {
    const removed = deleteExpiredSessions(db);
    if (removed > 0) logger.debug({ removed }, 'removed expired sessions');
  }, SESSION_CLEANUP_INTERVAL_MS);
  timer.unref();
  return () => {
    clearInterval(timer);
  };
}
