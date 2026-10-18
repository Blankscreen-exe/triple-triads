/**
 * Opening the SQLite database and applying migrations.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Sqlite from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type AppDatabase = BetterSQLite3Database<typeof schema> & { $client: Sqlite.Database };
export type AppTransaction = Parameters<Parameters<AppDatabase['transaction']>[0]>[0];
/** Anything that can run queries: the database itself or an open transaction. */
export type DbExecutor = AppDatabase | AppTransaction;

/** Directory with the generated SQL migrations, relative to the app directory. */
const MIGRATIONS_DIR = 'drizzle';

/**
 * Opens (creating if needed) the database at `path`. Use `':memory:'` for tests.
 */
export function openDatabase(path: string): AppDatabase {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const sqlite = new Sqlite(path);
  // WAL lets readers proceed while a write is in progress; the busy timeout covers the rare case
  // of two connections writing at once (the custom server and the Next.js runtime each hold one).
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('foreign_keys = ON');

  return drizzle({ client: sqlite, schema });
}

/** Absolute path of the migrations shipped with the app. */
export function migrationsFolder(): string {
  return resolve(MIGRATIONS_DIR);
}

/** Applies pending migrations; `folder` is only overridden by tests. */
export function migrateDatabase(db: AppDatabase, folder: string = migrationsFolder()): void {
  migrate(db, { migrationsFolder: folder });
}

export function closeDatabase(db: AppDatabase): void {
  db.$client.close();
}
