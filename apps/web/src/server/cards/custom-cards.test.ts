import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CardInput } from '@/lib/validation/card';
import type { AppDatabase } from '../db/client';
import { createLocalStorage, type FileStorage } from '../storage/storage';
import { createTestDatabase, createTestUser } from '../testing/test-database';
import { listTrunk } from '../trunk/trunk';
import { processCardArt } from './card-art';
import { createCustomCard, deleteCustomCard } from './custom-cards';

const MODEST: CardInput = {
  name: 'Garden Moogle',
  stats: { top: 5, right: 4, bottom: 3, left: 6 },
  element: 'holy',
};

function image(width: number, height: number, format: 'png' | 'jpeg' = 'png'): Promise<Buffer> {
  const base = sharp({
    create: { width, height, channels: 4, background: { r: 200, g: 80, b: 40, alpha: 1 } },
  });
  return (format === 'png' ? base.png() : base.jpeg()).toBuffer();
}

let dir: string;
let storage: FileStorage;
let db: AppDatabase;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tt-cards-'));
  storage = createLocalStorage(dir);
  db = createTestDatabase();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('processCardArt', () => {
  it('crops any image onto the card canvas in two sizes', async () => {
    const result = await processCardArt(await image(800, 400));
    if (!result.ok) throw new Error(result.error);

    const full = await sharp(result.art.full).metadata();
    const card = await sharp(result.art.card).metadata();
    expect([full.format, full.width, full.height]).toEqual(['webp', 1024, 1434]);
    expect([card.width, card.height]).toEqual([512, 717]);
    expect(result.art.hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('accepts JPEG photos', async () => {
    expect((await processCardArt(await image(600, 900, 'jpeg'))).ok).toBe(true);
  });

  it('rejects files that are not images', async () => {
    expect(await processCardArt(Buffer.from('<svg onload=alert(1)>'))).toEqual({
      ok: false,
      error: 'UNSUPPORTED_IMAGE',
    });
  });

  it('rejects images that are too small', async () => {
    expect(await processCardArt(await image(100, 300))).toEqual({
      ok: false,
      error: 'IMAGE_TOO_SMALL',
    });
  });

  it('rejects files over the size limit before decoding them', async () => {
    expect(await processCardArt(Buffer.alloc(6 * 1024 * 1024))).toEqual({
      ok: false,
      error: 'IMAGE_TOO_LARGE',
    });
  });
});

describe('createCustomCard', () => {
  it('creates a card the creator owns unlimited copies of', async () => {
    const user = await createTestUser(db);

    const result = await createCustomCard(db, storage, user.id, MODEST, null);
    if (!result.ok) throw new Error(result.error);

    const entry = listTrunk(db, user.id).find((item) => item.card.id === result.cardId);
    expect(entry).toMatchObject({
      quantity: 'unlimited',
      card: { name: 'Garden Moogle', artKey: null },
    });
  });

  it('stores uploaded art and remembers where', async () => {
    const user = await createTestUser(db);

    const result = await createCustomCard(db, storage, user.id, MODEST, await image(512, 512));
    if (!result.ok) throw new Error(result.error);
    const card = listTrunk(db, user.id).find((item) => item.card.id === result.cardId)?.card;

    expect(card?.artKey).toMatch(new RegExp(`^cards/${result.cardId}/[0-9a-f]{16}$`));
    expect(await storage.get(`${card?.artKey ?? ''}-card.webp`)).not.toBeNull();
    expect(await storage.get(`${card?.artKey ?? ''}-full.webp`)).not.toBeNull();
  });

  it('refuses cards above five stars', async () => {
    const user = await createTestUser(db);

    expect(
      await createCustomCard(
        db,
        storage,
        user.id,
        { ...MODEST, stats: { top: 10, right: 10, bottom: 10, left: 10 } },
        null,
      ),
    ).toEqual({ ok: false, error: 'TOO_STRONG' });
  });

  it('passes on art errors without creating the card', async () => {
    const user = await createTestUser(db);

    expect(await createCustomCard(db, storage, user.id, MODEST, Buffer.from('nope'))).toEqual({
      ok: false,
      error: 'UNSUPPORTED_IMAGE',
    });
    expect(listTrunk(db, user.id).some((item) => item.card.kind === 'custom')).toBe(false);
  });
});

describe('deleteCustomCard', () => {
  it('deletes the creator’s card and its art', async () => {
    const user = await createTestUser(db);
    const created = await createCustomCard(db, storage, user.id, MODEST, await image(512, 512));
    if (!created.ok) throw new Error(created.error);
    const artKey = listTrunk(db, user.id).find((item) => item.card.id === created.cardId)?.card
      .artKey;

    expect(await deleteCustomCard(db, storage, user.id, created.cardId)).toBe(true);
    expect(listTrunk(db, user.id).some((item) => item.card.id === created.cardId)).toBe(false);
    expect(await storage.get(`${artKey ?? ''}-card.webp`)).toBeNull();
  });

  it('refuses to delete someone else’s card or a generic card', async () => {
    const alice = await createTestUser(db, 'alice');
    const bob = await createTestUser(db, 'bob');
    const created = await createCustomCard(db, storage, alice.id, MODEST, null);
    if (!created.ok) throw new Error(created.error);

    expect(await deleteCustomCard(db, storage, bob.id, created.cardId)).toBe(false);
    expect(await deleteCustomCard(db, storage, alice.id, 'generic-sand-lizard')).toBe(false);
  });
});
