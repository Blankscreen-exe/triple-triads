/**
 * Guards against migrations that lose data. SQLite cannot alter some table properties in place,
 * and generated migrations then rebuild the table; with foreign keys on, dropping the old table
 * cascades and silently deletes dependent rows. This test upgrades a populated database from the
 * previous schema and checks every row survives.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, describe, expect, it } from 'vitest';
import { migrateDatabase, openDatabase } from './client';

interface Journal {
  entries: { idx: number; tag: string }[];
}

const MIGRATIONS = resolve('drizzle');
const journal = JSON.parse(
  readFileSync(join(MIGRATIONS, 'meta', '_journal.json'), 'utf8'),
) as Journal;

const temporaryDirs: string[] = [];
afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A migrations folder containing only the first `count` migrations. */
function migrationsUpTo(count: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'tt-migrations-'));
  temporaryDirs.push(dir);
  cpSync(MIGRATIONS, dir, { recursive: true });
  const partial: Journal = { ...journal, entries: journal.entries.slice(0, count) };
  writeFileSync(join(dir, 'meta', '_journal.json'), JSON.stringify(partial));
  return dir;
}

const count = (db: ReturnType<typeof openDatabase>, table: string): number =>
  (db.$client.prepare(`select count(*) as n from ${table}`).get() as { n: number }).n;

describe('migrations', () => {
  it.runIf(journal.entries.length > 1)(
    'upgrade a populated database from the previous schema without losing rows',
    () => {
      const db = openDatabase(':memory:');
      migrate(db, { migrationsFolder: migrationsUpTo(journal.entries.length - 1) });

      // Rows in every table that depends on users, written with the previous schema.
      const now = Date.now();
      db.$client.exec(`
        insert into users (id, username, username_key, password_hash, role, created_at)
          values ('u1', 'Squall', 'squall', 'hash', 'admin', ${String(now)});
        insert into sessions (id, user_id, expires_at, created_at)
          values ('s1', 'u1', ${String(now + 1000)}, ${String(now)});
        insert into cards (id, name, top, right, bottom, left, kind, creator_id, created_at)
          values ('c1', 'Mine', 1, 2, 3, 4, 'custom', 'u1', ${String(now)});
        insert into decks (id, user_id, name, created_at, updated_at)
          values ('d1', 'u1', 'Deck', ${String(now)}, ${String(now)});
        insert into deck_cards (deck_id, card_id, quantity) values ('d1', 'c1', 2);
        update users set active_deck_id = 'd1' where id = 'u1';
      `);
      const before = ['users', 'sessions', 'cards', 'decks', 'deck_cards'].map((table) => [
        table,
        count(db, table),
      ]);

      migrateDatabase(db);

      expect(
        ['users', 'sessions', 'cards', 'decks', 'deck_cards'].map((table) => [
          table,
          count(db, table),
        ]),
      ).toEqual(before);
      expect(db.$client.prepare('select active_deck_id from users').get()).toEqual({
        active_deck_id: 'd1',
      });
    },
  );

  it('creates the full schema on an empty database', () => {
    const db = openDatabase(':memory:');

    expect(() => {
      migrateDatabase(db);
    }).not.toThrow();
  });
});
