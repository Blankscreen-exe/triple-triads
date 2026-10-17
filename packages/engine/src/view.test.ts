import { describe, expect, it } from 'vitest';
import { createGame } from './game';
import { BASIC_RULES } from './rules';
import { uniformDeck } from './test-utils';
import { viewFor } from './view';

const game = (open: boolean) =>
  createGame({
    rules: { ...BASIC_RULES, open },
    decks: { red: uniformDeck([5, 5, 5, 5]), blue: uniformDeck([5, 5, 5, 5]) },
    seed: 11,
  });

describe('viewFor', () => {
  it('shows players their own hand but only the size of the opponent’s', () => {
    const state = game(false);

    const view = viewFor(state, 'red');

    expect(view.players.red.hand).toEqual({ size: 4, cards: state.players.red.hand });
    expect(view.players.blue.hand).toEqual({ size: 3, cards: null });
  });

  it('hides both hands from spectators', () => {
    const view = viewFor(game(false), 'spectator');

    expect(view.players.red.hand.cards).toBeNull();
    expect(view.players.blue.hand.cards).toBeNull();
  });

  it('shows every hand to everyone when the Open rule is on', () => {
    const state = game(true);

    const view = viewFor(state, 'spectator');

    expect(view.players.red.hand.cards).toEqual(state.players.red.hand);
    expect(view.players.blue.hand.cards).toEqual(state.players.blue.hand);
  });

  it('never reveals the draw piles, only their sizes', () => {
    const view = viewFor(game(true), 'red');

    expect(view.players.red).toEqual({ hand: expect.anything() as unknown, drawPileSize: 16 });
    expect(JSON.stringify(view)).not.toContain('drawPile"');
  });

  it('includes the live score', () => {
    expect(viewFor(game(false), 'blue').score).toEqual({ red: 5, blue: 5 });
  });
});
