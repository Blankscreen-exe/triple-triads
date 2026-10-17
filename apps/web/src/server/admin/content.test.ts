import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CardInput } from '@/lib/validation/card';
import { createCustomCard } from '../cards/custom-cards';
import {
  deleteGenericCard,
  getGenericCard,
  listGenericCards,
  saveGenericCard,
} from '../cards/generic-cards';
import { seedStarterContent } from '../catalog/seed';
import {
  createStarterDeck,
  deleteStarterDeck,
  listStarterDecks,
  saveStarterDeck,
  setDefaultStarterDeck,
} from '../catalog/starter-decks';
import type { AppDatabase } from '../db/client';
import { listDecks } from '../decks/decks';
import { createLocalStorage, type FileStorage } from '../storage/storage';
import { createTestDatabase, createTestUser } from '../testing/test-database';
import { listCustomCards, removeCustomCard } from './moderation';

const CARD: CardInput = {
  name: 'Moomba',
  stats: { top: 4, right: 5, bottom: 3, left: 6 },
  element: 'fire',
};

const art = (color: number) =>
  sharp({
    create: {
      width: 400,
      height: 560,
      channels: 4,
      background: { r: color, g: 40, b: 40, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

let dir: string;
let storage: FileStorage;
let db: AppDatabase;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tt-admin-'));
  storage = createLocalStorage(dir);
  db = createTestDatabase();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('generic cards', () => {
  it('creates and edits a generic card, replacing its art', async () => {
    const created = await saveGenericCard(db, storage, null, CARD, await art(200));
    if (!created.ok) throw new Error(created.error);
    const firstArt = getGenericCard(db, created.data.cardId)?.artKey;

    const edited = await saveGenericCard(
      db,
      storage,
      created.data.cardId,
      { ...CARD, name: 'Moomba Prime' },
      await art(90),
    );

    expect(edited.ok).toBe(true);
    const card = getGenericCard(db, created.data.cardId);
    expect(card?.name).toBe('Moomba Prime');
    expect(card?.artKey).not.toBe(firstArt);
    expect(await storage.get(`${firstArt ?? ''}-card.webp`)).toBeNull();
    expect(await storage.get(`${card?.artKey ?? ''}-card.webp`)).not.toBeNull();
    expect(listGenericCards(db).some((entry) => entry.name === 'Moomba Prime')).toBe(true);
  });

  it('keeps the existing art when an edit has none', async () => {
    const created = await saveGenericCard(db, storage, null, CARD, await art(200));
    if (!created.ok) throw new Error(created.error);
    const artKey = getGenericCard(db, created.data.cardId)?.artKey;

    await saveGenericCard(db, storage, created.data.cardId, { ...CARD, name: 'Renamed' }, null);

    expect(getGenericCard(db, created.data.cardId)?.artKey).toBe(artKey);
  });

  it('refuses cards above five stars and unknown cards', async () => {
    expect(
      await saveGenericCard(
        db,
        storage,
        null,
        { ...CARD, stats: { top: 10, right: 10, bottom: 10, left: 10 } },
        null,
      ),
    ).toEqual({ ok: false, error: 'TOO_STRONG' });
    expect(await saveGenericCard(db, storage, 'generic-nope', CARD, null)).toEqual({
      ok: false,
      error: 'CARD_NOT_FOUND',
    });
  });

  it('cannot delete a card a starter deck uses, but can delete an unused one', async () => {
    expect(await deleteGenericCard(db, storage, 'generic-sand-lizard')).toEqual({
      ok: false,
      error: 'IN_STARTER_DECK',
    });

    const created = await saveGenericCard(db, storage, null, CARD, null);
    if (!created.ok) throw new Error(created.error);
    expect(await deleteGenericCard(db, storage, created.data.cardId)).toEqual({
      ok: true,
      data: null,
    });
    expect(getGenericCard(db, created.data.cardId)).toBeNull();
  });
});

describe('starter decks', () => {
  it('builds a new starter deck that new players receive', async () => {
    const created = createStarterDeck(db, 'Rookie');
    if (!created.ok) throw new Error(created.error);

    const saved = saveStarterDeck(db, created.data.deckId, {
      name: 'Rookie',
      entries: [{ cardId: 'generic-sand-lizard', quantity: 3 }],
    });
    const player = await createTestUser(db);

    expect(saved).toEqual({ ok: true, data: null });
    expect(listDecks(db, player.id).find((deck) => deck.name === 'Rookie')?.size).toBe(3);
  });

  it('only accepts generic cards', async () => {
    const player = await createTestUser(db);
    const custom = await createCustomCard(db, storage, player.id, CARD, null);
    if (!custom.ok) throw new Error(custom.error);
    const [deck] = listStarterDecks(db);
    if (!deck) throw new Error('missing deck');

    expect(
      saveStarterDeck(db, deck.id, {
        name: deck.name,
        entries: [{ cardId: custom.cardId, quantity: 1 }],
      }),
    ).toEqual({ ok: false, error: 'NOT_A_GENERIC_CARD' });
  });

  it('keeps exactly one default', () => {
    const vanguard = listStarterDecks(db).find((deck) => deck.name === 'Vanguard');
    if (!vanguard) throw new Error('missing deck');

    setDefaultStarterDeck(db, vanguard.id);

    expect(
      listStarterDecks(db)
        .filter((deck) => deck.isDefault)
        .map((deck) => deck.name),
    ).toEqual(['Vanguard']);
  });

  it('passes the default on when the default deck is deleted', () => {
    const wanderer = listStarterDecks(db).find((deck) => deck.isDefault);
    if (!wanderer) throw new Error('missing deck');

    deleteStarterDeck(db, wanderer.id);

    expect(listStarterDecks(db).map((deck) => [deck.name, deck.isDefault])).toEqual([
      ['Elementalist', true],
      ['Vanguard', false],
    ]);
  });
});

describe('seeding', () => {
  it('never brings the default content back after admins delete it', () => {
    for (const deck of listStarterDecks(db)) deleteStarterDeck(db, deck.id);

    expect(seedStarterContent(db)).toBe(false);
    expect(listStarterDecks(db)).toEqual([]);
  });
});

describe('moderation', () => {
  it('lists custom cards with their creators and removes any of them', async () => {
    const player = await createTestUser(db, 'artist');
    const created = await createCustomCard(db, storage, player.id, CARD, await art(150));
    if (!created.ok) throw new Error(created.error);

    expect(listCustomCards(db).map((entry) => [entry.card.name, entry.creator])).toEqual([
      ['Moomba', 'artist'],
    ]);
    expect(await removeCustomCard(db, storage, created.cardId)).toBe(true);
    expect(listCustomCards(db)).toEqual([]);
    expect(await removeCustomCard(db, storage, 'generic-sand-lizard')).toBe(false);
  });
});
