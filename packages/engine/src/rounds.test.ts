import { describe, expect, it } from 'vitest';
import type { Position } from './board';
import { applyMove, createGame } from './game';
import { BASIC_RULES, MIN_CARDS_PER_GAME } from './rules';
import { canPlayRound, remainingAfterRound } from './rounds';
import type { GameState } from './state';
import { firstCard, uniformDeck } from './test-utils';
import type { CardDefinition } from './types';

function playToEnd(state: GameState): GameState {
  let current = state;
  for (let position = 0; position < 9; position++) {
    const result = applyMove(current, {
      player: current.activePlayer,
      instanceId: firstCard(current),
      position: position as Position,
    });
    if (!result.ok) throw new Error(result.error);
    current = result.state;
  }
  return current;
}

describe('remainingAfterRound', () => {
  it('uses up the cards each player placed, whoever controls them now', () => {
    const red = uniformDeck([9, 9, 9, 9]);
    const blue = uniformDeck([1, 1, 1, 1]);
    // Red's 9s capture every blue card, so blue ends up controlling none of its own.
    const round = playToEnd(createGame({ rules: BASIC_RULES, decks: { red, blue }, seed: 3 }));

    expect(remainingAfterRound(red, round, 'red')).toHaveLength(red.length - 5);
    expect(remainingAfterRound(blue, round, 'blue')).toHaveLength(blue.length - 4);
  });

  it('removes one copy per card placed and returns cards that were only drawn', () => {
    const mixed: CardDefinition[] = [
      ...uniformDeck([5, 5, 5, 5]).slice(0, 10),
      ...Array.from({ length: 10 }, () => ({
        id: 'other',
        stats: { top: 2, right: 2, bottom: 2, left: 2 } as const,
        element: null,
      })),
    ];
    const round = playToEnd(
      createGame({ rules: BASIC_RULES, decks: { red: mixed, blue: mixed }, seed: 11 }),
    );
    const placedIds = round.board.flatMap((cell) =>
      cell.placed?.owner === 'red' ? [cell.placed.card.id] : [],
    );

    const left = remainingAfterRound(mixed, round, 'red');

    expect(left).toHaveLength(mixed.length - 5);
    for (const id of new Set(mixed.map((card) => card.id))) {
      const before = mixed.filter((card) => card.id === id).length;
      const used = placedIds.filter((placed) => placed === id).length;
      expect(left.filter((card) => card.id === id)).toHaveLength(before - used);
    }
  });

  it('refuses a round that does not match the deck', () => {
    const round = playToEnd(
      createGame({
        rules: BASIC_RULES,
        decks: { red: uniformDeck([5, 5, 5, 5]), blue: uniformDeck([5, 5, 5, 5]) },
        seed: 1,
      }),
    );

    expect(() => remainingAfterRound([], round, 'red')).toThrow(RangeError);
  });
});

describe('canPlayRound', () => {
  it('needs enough cards in both decks for a full round', () => {
    const enough = uniformDeck([5, 5, 5, 5]).slice(0, MIN_CARDS_PER_GAME);
    const short = enough.slice(1);

    expect(canPlayRound({ red: enough, blue: enough })).toBe(true);
    expect(canPlayRound({ red: enough, blue: short })).toBe(false);
  });

  it('allows three rounds from 20-card decks when the starting player swaps', () => {
    let decks = { red: uniformDeck([5, 5, 5, 5]), blue: uniformDeck([5, 5, 5, 5]) };
    let firstPlayer: 'red' | 'blue' = 'red';
    let rounds = 0;
    while (canPlayRound(decks)) {
      rounds++;
      const round = playToEnd(createGame({ rules: BASIC_RULES, decks, seed: rounds, firstPlayer }));
      decks = {
        red: remainingAfterRound(decks.red, round, 'red'),
        blue: remainingAfterRound(decks.blue, round, 'blue'),
      };
      firstPlayer = firstPlayer === 'red' ? 'blue' : 'red';
    }

    // Red started twice (5 + 4 + 5 cards), blue once (4 + 5 + 4).
    expect(rounds).toBe(3);
    expect([decks.red.length, decks.blue.length]).toEqual([6, 7]);
  });
});
