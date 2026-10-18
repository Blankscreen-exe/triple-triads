import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Sqlite from 'better-sqlite3';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ASSET_PACK } from '@/lib/asset-packs';
import { fromScoringConfig } from '@/lib/validation/settings';
import { createSession, validateSessionToken } from '../auth/sessions';
import { createCustomCard } from '../cards/custom-cards';
import { seedStarterContent } from '../catalog/seed';
import { migrateDatabase, migrationsFolder, openDatabase, type AppDatabase } from '../db/client';
import { createDeck } from '../decks/deck-editing';
import { getPlayerStats, recordMatch } from '../matches/matches';
import { getAssetPack, uploadPackPart } from '../packs/asset-packs';
import { getGameSettings, updateSetting } from '../settings/settings';
import { createLocalStorage, type FileStorage } from '../storage/storage';
import { createTestDatabase, createTestUser } from '../testing/test-database';
import { listTrunk } from '../trunk/trunk';
import { authenticateUser } from '../users/users';
import { createBackup, restoreBackup, type BackupManifest } from './backup';

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: { r: 20, g: 90, b: 200, alpha: 1 } } })
    .png()
    .toBuffer();

let dir: string;
let sourceStorage: FileStorage;
let targetStorage: FileStorage;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tt-backup-test-'));
  sourceStorage = createLocalStorage(join(dir, 'source'));
  targetStorage = createLocalStorage(join(dir, 'target'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** A server with two players, a custom card with art, a deck, a match, a setting and a style. */
async function populatedServer() {
  const db = createTestDatabase();
  const alice = await createTestUser(db, 'alice');
  const bob = await createTestUser(db, 'bob');
  const card = await createCustomCard(
    db,
    sourceStorage,
    alice.id,
    { name: 'Moogle', stats: { top: 5, right: 5, bottom: 5, left: 5 }, element: null },
    await png(600, 840),
  );
  if (!card.ok) throw new Error(card.error);
  createDeck(db, alice.id, 'Moogle party');
  recordMatch(db, {
    roomId: 'room',
    players: { red: alice, blue: bob },
    result: { winner: 'red', score: { red: 7, blue: 3 } },
    forfeit: false,
    rounds: 2,
  });
  updateSetting(db, 'scoring', {
    ...fromScoringConfig(getGameSettings(db).scoring),
    elementBonus: 25,
  });
  await uploadPackPart(db, sourceStorage, alice.id, 'stars', await png(120, 60));
  const session = createSession(db, alice.id);
  return { db, alice, bob, sessionToken: session.token };
}

/** Rebuilds an archive after changing its entries. */
function editArchive(
  archive: Uint8Array,
  change: (entries: Record<string, Uint8Array>) => void,
): Uint8Array {
  const entries = unzipSync(archive);
  change(entries);
  return zipSync(entries);
}

/** Runs `change` on the archive's database file. */
async function editArchiveDatabase(archive: Uint8Array, change: (db: Sqlite.Database) => void) {
  const path = join(dir, 'edit.sqlite');
  await writeFile(path, unzipSync(archive)['database.sqlite'] ?? new Uint8Array());
  const db = new Sqlite(path);
  change(db);
  db.close();
  const edited = await readFile(path);
  return editArchive(archive, (entries) => {
    entries['database.sqlite'] = edited;
  });
}

/** A server that already has its own player and a file of its own. */
async function otherServer(): Promise<AppDatabase> {
  const db = createTestDatabase();
  await createTestUser(db, 'carol');
  await targetStorage.put('cards/old/art.webp', Buffer.from('old'), 'image/webp');
  return db;
}

describe('createBackup', () => {
  it('packs a manifest, the database without login sessions, and every uploaded file', async () => {
    const { db } = await populatedServer();

    const archive = await createBackup(db, sourceStorage, {
      now: () => new Date('2026-10-19T10:00:00Z'),
    });
    const entries = unzipSync(archive);

    const manifest = JSON.parse(strFromU8(entries['manifest.json'] ?? new Uint8Array())) as unknown;
    expect(manifest).toEqual({
      format: 'triple-triad-backup',
      version: 1,
      createdAt: '2026-10-19T10:00:00.000Z',
      counts: {
        users: 2,
        cards: expect.any(Number) as number,
        decks: expect.any(Number) as number,
        matches: 1,
        files: (await sourceStorage.list()).length,
      },
    });
    const files = Object.keys(entries).filter((name) => name.startsWith('files/'));
    expect(files.toSorted()).toEqual(
      (await sourceStorage.list()).map((key) => `files/${key}`).toSorted(),
    );

    const exported = await editArchiveDatabase(archive, (copy) => {
      expect(copy.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 0 });
      expect(copy.prepare('SELECT count(*) AS n FROM users').get()).toEqual({ n: 2 });
    });
    expect(exported.byteLength).toBeGreaterThan(0);
  });
});

describe('restoreBackup', () => {
  it('replaces all data and files with the backup’s', async () => {
    const source = await populatedServer();
    const archive = await createBackup(source.db, sourceStorage);
    const target = await otherServer();
    const beforeReplace = vi.fn();

    const result = await restoreBackup(target, targetStorage, archive, { beforeReplace });

    expect(result).toMatchObject({ ok: true, manifest: { counts: { users: 2, matches: 1 } } });
    expect(beforeReplace).toHaveBeenCalledOnce();

    // Accounts and passwords come across; the other server's player is gone.
    expect(
      await authenticateUser(target, { username: 'alice', password: 'correct horse battery' }),
    ).toMatchObject({ ok: true, user: { id: source.alice.id, role: 'admin' } });
    expect(
      await authenticateUser(target, { username: 'carol', password: 'correct horse battery' }),
    ).toMatchObject({ ok: false });
    // Everyone logs in again.
    expect(validateSessionToken(target, source.sessionToken)).toBeNull();

    const moogle = listTrunk(target, source.alice.id).find((entry) => entry.card.name === 'Moogle');
    expect(moogle?.card.artKey).toBeTruthy();
    // Art is stored per size under the card's art key.
    expect(await targetStorage.get(`${moogle?.card.artKey ?? ''}-card.webp`)).not.toBeNull();
    expect(getPlayerStats(target, source.alice.id)).toMatchObject({ wins: 1 });
    expect(getGameSettings(target).scoring.elementBonus).toBe(25);
    expect(getAssetPack(target, source.alice.id).images.stars).not.toBe(
      DEFAULT_ASSET_PACK.images.stars,
    );

    // Files match the backup exactly: the other server's own file is removed.
    expect(await targetStorage.get('cards/old/art.webp')).toBeNull();
    expect((await targetStorage.list()).toSorted()).toEqual(
      (await sourceStorage.list()).toSorted(),
    );
  });

  it('upgrades a backup made before the latest database changes', async () => {
    // A copy of the migrations without the newest one, as an older version of the app had them.
    const oldFolder = join(dir, 'old-migrations');
    await cp(migrationsFolder(), oldFolder, { recursive: true });
    const journalPath = join(oldFolder, 'meta', '_journal.json');
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: unknown[] };
    journal.entries = journal.entries.slice(0, -1);
    await writeFile(journalPath, JSON.stringify(journal));

    const oldDb = openDatabase(':memory:');
    migrateDatabase(oldDb, oldFolder);
    seedStarterContent(oldDb);
    const veteran = await createTestUser(oldDb, 'veteran');
    const archive = await createBackup(oldDb, sourceStorage);
    const target = await otherServer();

    const result = await restoreBackup(target, targetStorage, archive);

    expect(result.ok).toBe(true);
    expect(
      await authenticateUser(target, { username: 'veteran', password: 'correct horse battery' }),
    ).toMatchObject({ ok: true, user: { id: veteran.id } });
  });

  describe('refuses, changing nothing,', () => {
    async function expectRefused(archive: Uint8Array, error: string) {
      const target = await otherServer();
      const beforeReplace = vi.fn();

      const result = await restoreBackup(target, targetStorage, archive, { beforeReplace });

      expect(result).toMatchObject({ ok: false, error });
      expect(beforeReplace).not.toHaveBeenCalled();
      expect(
        await authenticateUser(target, { username: 'carol', password: 'correct horse battery' }),
      ).toMatchObject({ ok: true });
      expect(await targetStorage.get('cards/old/art.webp')).not.toBeNull();
    }

    it('a file that is not a zip', async () => {
      await expectRefused(strToU8('definitely not a zip'), 'NOT_A_BACKUP');
    });

    it('an archive from something else', async () => {
      const manifest: Partial<BackupManifest> = { format: 'triple-triad-backup' };
      await expectRefused(
        zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)) }),
        'NOT_A_BACKUP',
      );
    });

    it('a file name that would escape the storage folder', async () => {
      const { db } = await populatedServer();
      const archive = editArchive(await createBackup(db, sourceStorage), (entries) => {
        entries['files/../../outside.png'] = strToU8('x');
      });
      await expectRefused(archive, 'NOT_A_BACKUP');
    });

    it('a damaged database', async () => {
      const { db } = await populatedServer();
      const archive = editArchive(await createBackup(db, sourceStorage), (entries) => {
        entries['database.sqlite'] = strToU8('these bytes are not a database');
      });
      await expectRefused(archive, 'CORRUPT_DATABASE');
    });

    it('a backup from a newer version of the app', async () => {
      const { db } = await populatedServer();
      const archive = await editArchiveDatabase(await createBackup(db, sourceStorage), (copy) => {
        copy
          .prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
          .run('a-migration-from-the-future', Date.now());
      });
      await expectRefused(archive, 'NEWER_VERSION');
    });
  });
});
