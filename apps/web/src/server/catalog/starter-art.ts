/**
 * Stores the art of the starter cards that come with some, from assets/starter-art. This needs
 * the storage and takes a few seconds, so it is a separate step from inserting the cards.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { storeCardArt } from '../cards/card-art';
import type { AppDatabase } from '../db/client';
import { cards, settings } from '../db/schema';
import type { FileStorage } from '../storage/storage';
import { STARTER_CARDS } from './starter-content';

/** Marks that the art was stored, so art an admin has since removed does not come back. */
const ART_FLAG = 'seed:starterArt';

export function starterArtPath(art: string): string {
  return resolve('assets/starter-art', `${art}.webp`);
}

/**
 * Gives the starter cards their art, skipping cards an admin has deleted or given other art.
 * Safe to call on every startup; if it fails part-way, the next startup finishes the job.
 * Returns how many cards were given art.
 */
export async function seedStarterArt(db: AppDatabase, storage: FileStorage): Promise<number> {
  if (db.select({ key: settings.key }).from(settings).where(eq(settings.key, ART_FLAG)).get()) {
    return 0;
  }

  let stored = 0;
  for (const { id, art } of STARTER_CARDS) {
    if (art === null) continue;
    const row = db.select({ artKey: cards.artKey }).from(cards).where(eq(cards.id, id)).get();
    if (row?.artKey !== null) continue;

    const result = await storeCardArt(storage, id, await readFile(starterArtPath(art)));
    if (!result.ok) throw new Error(`Could not store the art of ${id}: ${result.error}`);
    db.update(cards).set({ artKey: result.artKey }).where(eq(cards.id, id)).run();
    stored++;
  }

  db.insert(settings)
    .values({ key: ART_FLAG, value: { at: new Date().toISOString() } })
    .run();
  return stored;
}
