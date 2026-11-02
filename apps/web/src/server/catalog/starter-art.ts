/**
 * Stores the art of the starter cards that come with some, from assets/starter-art. This needs
 * the storage and takes a few seconds, so it is a separate step from inserting the cards.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import { storeCardArt } from '../cards/card-art';
import type { AppDatabase } from '../db/client';
import { cards, settings } from '../db/schema';
import type { FileStorage } from '../storage/storage';
import { PORTRAIT_SETS, type PortraitSet } from './starter-content';

/**
 * Marks that a set's art was stored, so art an admin has since removed does not come back. The
 * first set's flag predates there being several.
 */
const artFlag = (set: PortraitSet) =>
  set.id === 'stardust-crusaders' ? 'seed:starterArt' : `seed:starterArt:${set.id}`;

export function starterArtPath(art: string): string {
  return resolve('assets/starter-art', `${art}.webp`);
}

/**
 * Gives the starter cards their art, a set at a time, skipping cards an admin has deleted or given
 * other art. A set none of whose cards exist yet is left for a later startup rather than marked
 * done. Safe to call on every startup; if it fails part-way, the next startup finishes the job.
 * Returns how many cards were given art.
 */
export async function seedStarterArt(db: AppDatabase, storage: FileStorage): Promise<number> {
  let stored = 0;
  for (const set of PORTRAIT_SETS) {
    const flag = artFlag(set);
    if (db.select({ key: settings.key }).from(settings).where(eq(settings.key, flag)).get()) {
      continue;
    }
    const ids = set.cards.map((card) => card.id);
    if (!db.select({ id: cards.id }).from(cards).where(inArray(cards.id, ids)).get()) continue;

    for (const { id, art } of set.cards) {
      if (art === null) continue;
      const row = db.select({ artKey: cards.artKey }).from(cards).where(eq(cards.id, id)).get();
      if (row?.artKey !== null) continue;

      const result = await storeCardArt(storage, id, await readFile(starterArtPath(art)));
      if (!result.ok) throw new Error(`Could not store the art of ${id}: ${result.error}`);
      db.update(cards).set({ artKey: result.artKey }).where(eq(cards.id, id)).run();
      stored++;
    }

    db.insert(settings)
      .values({ key: flag, value: { at: new Date().toISOString() } })
      .run();
  }
  return stored;
}
