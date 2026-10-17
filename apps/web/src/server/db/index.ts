/**
 * The process-wide database connection used by Next.js server code (pages and server actions).
 *
 * The custom server opens its own connection and applies migrations before Next.js starts
 * (see `src/server/index.ts`), so this module only connects.
 */
import { loadConfig } from '../config';
import { openDatabase, type AppDatabase } from './client';

// Kept on globalThis so hot reloading in development does not open a new connection per edit.
const globalForDb = globalThis as typeof globalThis & { __tripleTriadDb?: AppDatabase };

export function getDatabase(): AppDatabase {
  globalForDb.__tripleTriadDb ??= openDatabase(loadConfig(process.env).databasePath);
  return globalForDb.__tripleTriadDb;
}
