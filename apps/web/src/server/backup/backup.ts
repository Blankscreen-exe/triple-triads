/**
 * Exporting and importing all server data (design/SPEC.md, 11.1): one zip archive with
 *
 *   manifest.json     format, version, when it was made, and what it contains
 *   database.sqlite   a consistent copy of the database, without login sessions
 *   files/<key>       every uploaded file (card art, card styles), by storage key
 *
 * Importing replaces everything. The archive's database is upgraded to this version of the app
 * first (so older backups can be restored), then copied into the live database in one
 * transaction; files are written before the data switches over and old ones removed after, so a
 * failure part-way never leaves the data pointing at missing files.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Sqlite from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { z } from 'zod';
import { migrationsFolder, type AppDatabase } from '../db/client';
import { contentTypeFor, isValidStorageKey, type FileStorage } from '../storage/storage';

export const BACKUP_FORMAT = 'triple-triad-backup';
export const BACKUP_VERSION = 1;
/** Largest archive accepted for import. */
export const MAX_BACKUP_BYTES = 512 * 1024 * 1024;
/** Largest total size of the archive's contents once unpacked (guards against zip bombs). */
const MAX_UNPACKED_BYTES = 2 * 1024 * 1024 * 1024;

const MANIFEST = 'manifest.json';
const DATABASE = 'database.sqlite';
const FILES = 'files/';
/** Drizzle's record of applied migrations: kept as is, never copied between databases. */
const MIGRATIONS_TABLE = '__drizzle_migrations';
/** Tables that are emptied rather than restored: everyone logs in again after an import. */
const NOT_EXPORTED = ['sessions'];

const manifestSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  createdAt: z.iso.datetime(),
  counts: z.object({
    users: z.number().int().min(0),
    cards: z.number().int().min(0),
    decks: z.number().int().min(0),
    matches: z.number().int().min(0),
    files: z.number().int().min(0),
  }),
});
export type BackupManifest = z.infer<typeof manifestSchema>;

export type RestoreError =
  /** Not a zip archive, or not one made by this app. */
  | 'NOT_A_BACKUP'
  /** Made by a newer version of the app (unknown database version). */
  | 'NEWER_VERSION'
  /** The archive's database is damaged or inconsistent. */
  | 'CORRUPT_DATABASE'
  /** Over the size limits. */
  | 'TOO_LARGE';

export type RestoreResult =
  | { readonly ok: true; readonly manifest: BackupManifest }
  | { readonly ok: false; readonly error: RestoreError; readonly detail?: string };

interface Options {
  /** Migrations to upgrade the backup with; only tests override this. */
  readonly migrationsFolder?: string;
  readonly now?: () => Date;
}

// ---- Export ---------------------------------------------------------------------------------

/** Builds a backup archive of the whole server: database and uploaded files. */
export async function createBackup(
  db: AppDatabase,
  storage: FileStorage,
  { now = () => new Date() }: Options = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const dir = await mkdtemp(join(tmpdir(), 'tt-backup-'));
  try {
    // SQLite's online backup: a consistent snapshot even while the server keeps writing.
    const copyPath = join(dir, DATABASE);
    await db.$client.backup(copyPath);
    const counts = withSqlite(copyPath, (copy) => {
      for (const table of NOT_EXPORTED) copy.exec(`DELETE FROM "${table}"`);
      // Rewrites the file so deleted rows do not linger in free pages.
      copy.exec('VACUUM');
      const count = (table: string) =>
        (copy.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }).n;
      return {
        users: count('users'),
        cards: count('cards'),
        decks: count('decks'),
        matches: count('matches'),
      };
    });

    const entries: Zippable = {};
    const keys = await storage.list();
    for (const key of keys) {
      const file = await storage.get(key);
      // Already-compressed images: stored as they are.
      if (file) entries[FILES + key] = [file.data, { level: 0 }];
    }

    const manifest: BackupManifest = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: now().toISOString(),
      counts: { ...counts, files: keys.length },
    };
    entries[MANIFEST] = strToU8(JSON.stringify(manifest, null, 2));
    entries[DATABASE] = await readFile(copyPath);
    return zipSync(entries);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ---- Import ---------------------------------------------------------------------------------

interface Unpacked {
  readonly manifest: BackupManifest;
  readonly database: Uint8Array;
  readonly files: ReadonlyMap<string, Uint8Array>;
}

/**
 * Replaces all server data with the archive's. `beforeReplace` runs once the archive has been
 * fully checked, just before anything changes (e.g. to close the rooms in play).
 */
export async function restoreBackup(
  db: AppDatabase,
  storage: FileStorage,
  archive: Uint8Array,
  {
    beforeReplace,
    migrationsFolder: folder = migrationsFolder(),
  }: Options & { readonly beforeReplace?: () => void } = {},
): Promise<RestoreResult> {
  if (archive.byteLength > MAX_BACKUP_BYTES) return { ok: false, error: 'TOO_LARGE' };
  const unpacked = unpack(archive);
  if (!unpacked.ok) return unpacked;
  const { manifest, database, files } = unpacked.value;

  const dir = await mkdtemp(join(tmpdir(), 'tt-restore-'));
  try {
    const backupPath = join(dir, DATABASE);
    await writeFile(backupPath, database);
    const prepared = prepareDatabase(backupPath, folder, db.$client);
    if (!prepared.ok) return prepared;

    beforeReplace?.();
    for (const [key, data] of files) await storage.put(key, Buffer.from(data), contentTypeFor(key));
    try {
      replaceData(db.$client, backupPath);
    } catch (error) {
      // The transaction rolled back: the live data is unchanged (new files are only extra).
      return {
        ok: false,
        error: 'CORRUPT_DATABASE',
        detail: error instanceof Error ? error.message : undefined,
      };
    }
    for (const key of await storage.list()) {
      if (!files.has(key)) await storage.delete(key);
    }
    return { ok: true, manifest };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

type Checked<T> = { ok: true; value: T } | { ok: false; error: RestoreError; detail?: string };

/** Reads and checks the archive without touching anything. */
function unpack(archive: Uint8Array): Checked<Unpacked> {
  let entries: Record<string, Uint8Array>;
  let unpackedBytes = 0;
  try {
    entries = unzipSync(archive, {
      filter: (entry) => {
        unpackedBytes += entry.originalSize;
        if (unpackedBytes > MAX_UNPACKED_BYTES) throw new TooLarge();
        return true;
      },
    });
  } catch (error) {
    if (error instanceof TooLarge) return { ok: false, error: 'TOO_LARGE' };
    return { ok: false, error: 'NOT_A_BACKUP', detail: 'The file is not a zip archive.' };
  }

  const manifestBytes = entries[MANIFEST];
  const database = entries[DATABASE];
  if (!manifestBytes || !database) {
    return { ok: false, error: 'NOT_A_BACKUP', detail: 'The archive has no manifest or database.' };
  }
  let manifest: BackupManifest;
  try {
    const parsed = manifestSchema.safeParse(JSON.parse(strFromU8(manifestBytes)));
    if (!parsed.success) return { ok: false, error: 'NOT_A_BACKUP', detail: 'Unknown manifest.' };
    manifest = parsed.data;
  } catch {
    return { ok: false, error: 'NOT_A_BACKUP', detail: 'Unreadable manifest.' };
  }

  const files = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(entries)) {
    if (name === MANIFEST || name === DATABASE || name.endsWith('/')) continue;
    const key = name.startsWith(FILES) ? name.slice(FILES.length) : null;
    // Keys become paths on disk: anything unexpected is refused rather than skipped.
    if (key === null || !isValidStorageKey(key)) {
      return { ok: false, error: 'NOT_A_BACKUP', detail: `Unexpected entry "${name}".` };
    }
    files.set(key, data);
  }
  return { ok: true, value: { manifest, database, files } };
}

/**
 * Checks the archive's database and upgrades it to this app's schema, in its own file. Fails if
 * it was made by a newer version (a migration this app does not know) or does not match.
 */
function prepareDatabase(path: string, folder: string, live: Sqlite.Database): Checked<null> {
  try {
    return withSqlite(path, (backup): Checked<null> => {
      if (backup.pragma('integrity_check', { simple: true }) !== 'ok') {
        return { ok: false, error: 'CORRUPT_DATABASE' };
      }
      if (!tableNames(backup).includes(MIGRATIONS_TABLE)) {
        return { ok: false, error: 'NOT_A_BACKUP', detail: 'Not a Triple Triad database.' };
      }

      const known = new Set(readMigrationFiles({ migrationsFolder: folder }).map((m) => m.hash));
      const applied = backup.prepare(`SELECT hash FROM "${MIGRATIONS_TABLE}"`).all() as {
        hash: string;
      }[];
      if (applied.some(({ hash }) => !known.has(hash))) {
        return { ok: false, error: 'NEWER_VERSION' };
      }

      backup.pragma('foreign_keys = ON');
      migrate(drizzle({ client: backup }), { migrationsFolder: folder });
      if ((backup.pragma('foreign_key_check') as unknown[]).length > 0) {
        return { ok: false, error: 'CORRUPT_DATABASE', detail: 'Broken references.' };
      }

      // Same migrations, so the same tables and columns; checked anyway before copying.
      for (const table of dataTables(live)) {
        if (columnNames(live, table).join() !== columnNames(backup, table).join()) {
          return { ok: false, error: 'CORRUPT_DATABASE', detail: `Table "${table}" differs.` };
        }
      }
      return { ok: true, value: null };
    });
  } catch {
    return { ok: false, error: 'CORRUPT_DATABASE' };
  }
}

/** Swaps every table's rows for the backup's, in one transaction. */
function replaceData(live: Sqlite.Database, backupPath: string): void {
  live.prepare('ATTACH DATABASE ? AS backup').run(backupPath);
  try {
    const tables = dataTables(live);
    live.transaction(() => {
      // References are checked when the transaction commits, once every table is complete.
      live.pragma('defer_foreign_keys = ON');
      // Empty everything first: deleting a parent row cascades to its children, which must not
      // happen to rows already copied in.
      for (const table of tables) live.exec(`DELETE FROM main."${table}"`);
      for (const table of tables) {
        if (NOT_EXPORTED.includes(table)) continue;
        const columns = columnNames(live, table)
          .map((column) => `"${column}"`)
          .join(', ');
        live.exec(
          `INSERT INTO main."${table}" (${columns}) SELECT ${columns} FROM backup."${table}"`,
        );
      }
    })();
  } finally {
    live.exec('DETACH DATABASE backup');
  }
}

// ---- Helpers --------------------------------------------------------------------------------

class TooLarge extends Error {}

function withSqlite<T>(path: string, action: (db: Sqlite.Database) => T): T {
  const db = new Sqlite(path);
  try {
    return action(db);
  } finally {
    db.close();
  }
}

function tableNames(db: Sqlite.Database): string[] {
  return (
    db.prepare("SELECT name FROM main.sqlite_master WHERE type = 'table' ORDER BY name").all() as {
      name: string;
    }[]
  ).map(({ name }) => name);
}

/** The app's own tables: everything but SQLite's internals and the migrations record. */
function dataTables(db: Sqlite.Database): string[] {
  return tableNames(db).filter((name) => !name.startsWith('sqlite_') && name !== MIGRATIONS_TABLE);
}

function columnNames(db: Sqlite.Database, table: string): string[] {
  return (db.pragma(`table_info("${table}")`) as { name: string }[]).map(({ name }) => name);
}
