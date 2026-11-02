import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq, isNotNull } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cards, settings } from '../db/schema';
import { createLocalStorage, type FileStorage } from '../storage/storage';
import { createTestDatabase } from '../testing/test-database';
import { seedStarterArt } from './starter-art';
import { PORTRAIT_SETS, STARTER_CARDS } from './starter-content';

const withArt = STARTER_CARDS.filter((card) => card.art !== null);
// Processing all the art takes a while on a slow machine.
const TIMEOUT_MS = 60_000;

describe('seedStarterArt', () => {
  let dir: string;
  let storage: FileStorage;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tt-starter-art-'));
    storage = createLocalStorage(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it(
    'stores the art once, and leaves art an admin removed or replaced',
    async () => {
      const db = createTestDatabase();
      const [replaced, removed] = withArt;
      if (!replaced || !removed) throw new Error('missing cards');
      db.update(cards).set({ artKey: 'cards/own/art' }).where(eq(cards.id, replaced.id)).run();

      expect(await seedStarterArt(db, storage)).toBe(withArt.length - 1);

      const row = db.select().from(cards).where(eq(cards.id, removed.id)).get();
      expect(await storage.get(`${row?.artKey ?? ''}-card.webp`)).not.toBeNull();
      expect(db.select().from(cards).where(eq(cards.id, replaced.id)).get()?.artKey).toBe(
        'cards/own/art',
      );

      db.update(cards).set({ artKey: null }).where(eq(cards.id, removed.id)).run();
      expect(await seedStarterArt(db, storage)).toBe(0);
      expect(db.select().from(cards).where(isNotNull(cards.artKey)).all()).toHaveLength(
        withArt.length - 1,
      );
    },
    TIMEOUT_MS,
  );

  it(
    'stores the art of sets added after an installation stored the first',
    async () => {
      const db = createTestDatabase();
      // The flag an installation got when the Stardust Crusaders were the only set.
      db.insert(settings)
        .values({ key: 'seed:starterArt', value: { at: new Date().toISOString() } })
        .run();
      const later = PORTRAIT_SETS.slice(1).flatMap((set) => set.cards);

      expect(await seedStarterArt(db, storage)).toBe(later.length);

      const stored = db.select({ id: cards.id }).from(cards).where(isNotNull(cards.artKey)).all();
      expect(stored.map((row) => row.id).sort()).toEqual(later.map((card) => card.id).sort());
    },
    TIMEOUT_MS,
  );
});
