import { describe, expect, it } from 'vitest';
import { cards } from '../db/schema';
import { createTestDatabase, createTestUser } from '../testing/test-database';
import { listTrunk } from './trunk';

describe('listTrunk', () => {
  it('includes the player’s own custom cards with unlimited copies', async () => {
    const db = createTestDatabase();
    const user = await createTestUser(db);
    db.insert(cards)
      .values({
        id: 'custom-1',
        name: 'My Card',
        top: 3,
        right: 3,
        bottom: 3,
        left: 3,
        element: null,
        kind: 'custom',
        creatorId: user.id,
      })
      .run();

    const entry = listTrunk(db, user.id).find((item) => item.card.id === 'custom-1');

    expect(entry?.quantity).toBe('unlimited');
  });

  it('does not include other players’ custom cards', async () => {
    const db = createTestDatabase();
    const alice = await createTestUser(db, 'alice');
    const bob = await createTestUser(db, 'bob');
    db.insert(cards)
      .values({
        id: 'custom-bob',
        name: 'Bob Card',
        top: 3,
        right: 3,
        bottom: 3,
        left: 3,
        element: null,
        kind: 'custom',
        creatorId: bob.id,
      })
      .run();

    expect(listTrunk(db, alice.id).some((item) => item.card.id === 'custom-bob')).toBe(false);
  });
});
