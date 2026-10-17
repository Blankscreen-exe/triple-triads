import { describe, expect, it } from 'vitest';
import type { Position } from './board';
import {
  applyMove,
  computeScore,
  createGame,
  legalMoves,
  playRandomMove,
  validateMove,
} from './game';
import {
  BASIC_RULES,
  CARDS_DRAWN_PER_TURN,
  INITIAL_HAND_SIZE,
  MAX_NORMAL_ELEMENTAL_CELLS,
  MIN_CARDS_PER_GAME,
  type RuleSet,
} from './rules';
import type { GameState } from './state';
import { deepFreeze, firstCard, uniformDeck } from './test-utils';

const newGame = (overrides: Partial<RuleSet> = {}, seed = 42): GameState =>
  createGame({
    rules: { ...BASIC_RULES, ...overrides },
    decks: { red: uniformDeck([5, 5, 5, 5]), blue: uniformDeck([5, 5, 5, 5]) },
    seed,
  });

function play(state: GameState, position: Position): GameState {
  const result = applyMove(state, {
    player: state.activePlayer,
    instanceId: firstCard(state),
    position,
  });
  if (!result.ok) throw new Error(`Unexpected move error: ${result.error}`);
  return result.state;
}

/** Fills the board in position order, always playing the first card in hand. */
function playToEnd(state: GameState): GameState {
  let current = state;
  for (let position = 0; position < 9; position++) current = play(current, position as Position);
  return current;
}

describe('createGame', () => {
  it('deals the initial hands and starts red’s first turn with a draw', () => {
    const state = newGame();

    expect(state.activePlayer).toBe('red');
    expect(state.turn).toBe(1);
    expect(state.result).toBeNull();
    expect(state.players.red.hand).toHaveLength(INITIAL_HAND_SIZE + CARDS_DRAWN_PER_TURN);
    expect(state.players.blue.hand).toHaveLength(INITIAL_HAND_SIZE);
    expect(state.players.red.drawPile).toHaveLength(20 - INITIAL_HAND_SIZE - CARDS_DRAWN_PER_TURN);
    expect(state.board.every((cell) => cell.placed === null)).toBe(true);
  });

  it('gives every card instance a unique id', () => {
    const state = newGame();
    const ids = (['red', 'blue'] as const).flatMap((color) =>
      [...state.players[color].hand, ...state.players[color].drawPile].map(
        (card) => card.instanceId,
      ),
    );

    expect(new Set(ids).size).toBe(40);
  });

  it('is deterministic for a given seed', () => {
    expect(newGame({ elemental: 'normal' }, 7)).toEqual(newGame({ elemental: 'normal' }, 7));
  });

  it('shuffles differently for different seeds', () => {
    const order = (state: GameState) => state.players.red.drawPile.map((card) => card.instanceId);

    expect(order(newGame({}, 1))).not.toEqual(order(newGame({}, 2)));
  });

  it('rejects decks that are too small for a game', () => {
    expect(() =>
      createGame({
        rules: BASIC_RULES,
        decks: {
          red: uniformDeck([1, 1, 1, 1], MIN_CARDS_PER_GAME - 1),
          blue: uniformDeck([1, 1, 1, 1]),
        },
        seed: 1,
      }),
    ).toThrow(RangeError);
  });

  describe('elemental squares', () => {
    const elementalCount = (state: GameState) =>
      state.board.filter((cell) => cell.element !== null).length;

    it('has none when Elemental is off', () => {
      expect(elementalCount(newGame({ elemental: 'off' }))).toBe(0);
    });

    it('gives every square an element in "all" mode', () => {
      expect(elementalCount(newGame({ elemental: 'all' }))).toBe(9);
    });

    it(`gives 0 to ${String(MAX_NORMAL_ELEMENTAL_CELLS)} squares an element in "normal" mode`, () => {
      const counts = new Set(
        Array.from({ length: 200 }, (_, seed) =>
          elementalCount(newGame({ elemental: 'normal' }, seed)),
        ),
      );

      expect([...counts].sort()).toEqual([0, 1, 2, 3]);
    });
  });
});

describe('applyMove', () => {
  it('places the card, ends the turn and makes the next player draw', () => {
    const state = newGame();
    const instanceId = firstCard(state);

    const result = applyMove(state, { player: 'red', instanceId, position: 4 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.state;
    expect(next.board[4]?.placed).toMatchObject({ instanceId, owner: 'red', controller: 'red' });
    expect(next.players.red.hand).toHaveLength(INITIAL_HAND_SIZE);
    expect(next.players.red.hand.some((card) => card.instanceId === instanceId)).toBe(false);
    expect(next.players.blue.hand).toHaveLength(INITIAL_HAND_SIZE + CARDS_DRAWN_PER_TURN);
    expect(next.activePlayer).toBe('blue');
    expect(next.turn).toBe(2);
  });

  it('does not mutate the previous state', () => {
    const state = deepFreeze(newGame({ same: true, plus: true, combo: true }));

    expect(() => playToEnd(state)).not.toThrow();
  });

  it('returns the captures made by the move', () => {
    const state = createGame({
      rules: BASIC_RULES,
      decks: { red: uniformDeck([9, 9, 9, 9]), blue: uniformDeck([1, 1, 1, 1]) },
      seed: 3,
    });
    const afterRed = play(state, 0);
    const blueMove = applyMove(afterRed, {
      player: 'blue',
      instanceId: firstCard(afterRed),
      position: 1,
    });
    if (!blueMove.ok) throw new Error(blueMove.error);

    const redMove = applyMove(blueMove.state, {
      player: 'red',
      instanceId: firstCard(blueMove.state),
      position: 2,
    });

    expect(redMove.ok && redMove.captures).toEqual([
      { position: 1, cause: 'basic', from: 'blue', to: 'red', wave: 0 },
    ]);
  });

  describe('rejects illegal moves', () => {
    const state = newGame();

    it('when it is not the player’s turn', () => {
      const instanceId = state.players.blue.hand[0]?.instanceId ?? '';
      expect(applyMove(state, { player: 'blue', instanceId, position: 0 })).toEqual({
        ok: false,
        error: 'NOT_YOUR_TURN',
      });
    });

    it('when the card is not in the player’s hand', () => {
      const instanceId = state.players.red.drawPile[0]?.instanceId ?? '';
      expect(validateMove(state, { player: 'red', instanceId, position: 0 })).toBe(
        'CARD_NOT_IN_HAND',
      );
    });

    it('when the position does not exist', () => {
      const move = {
        player: 'red',
        instanceId: firstCard(state),
        position: 9 as Position,
      } as const;
      expect(validateMove(state, move)).toBe('INVALID_POSITION');
    });

    it('when the square is taken', () => {
      const next = play(state, 4);
      expect(validateMove(next, { player: 'blue', instanceId: firstCard(next), position: 4 })).toBe(
        'CELL_OCCUPIED',
      );
    });

    it('when the game is over', () => {
      const finished = playToEnd(state);
      expect(validateMove(finished, { player: 'red', instanceId: 'red-0', position: 0 })).toBe(
        'GAME_OVER',
      );
    });
  });
});

describe('end of game', () => {
  it('ends after nine placements with red placing five cards and blue four', () => {
    const finished = playToEnd(newGame());

    expect(finished.result).not.toBeNull();
    expect(finished.players.red.placedCount).toBe(5);
    expect(finished.players.blue.placedCount).toBe(4);
    expect(legalMoves(finished)).toEqual([]);
  });

  it('is a 5–5 draw when nothing is captured', () => {
    expect(playToEnd(newGame()).result).toEqual({ winner: null, score: { red: 5, blue: 5 } });
  });

  it('declares the player with more points the winner', () => {
    const state = createGame({
      rules: BASIC_RULES,
      decks: { red: uniformDeck([9, 9, 9, 9]), blue: uniformDeck([1, 1, 1, 1]) },
      seed: 5,
    });

    const result = playToEnd(state).result;

    expect(result?.winner).toBe('red');
    expect((result?.score.red ?? 0) + (result?.score.blue ?? 0)).toBe(10);
  });
});

describe('computeScore', () => {
  it('starts at 5–5 and is unchanged by placing a card', () => {
    const state = newGame();

    expect(computeScore(state)).toEqual({ red: 5, blue: 5 });
    expect(computeScore(play(state, 0))).toEqual({ red: 5, blue: 5 });
  });

  it('moves one point per capture', () => {
    const state = createGame({
      rules: BASIC_RULES,
      decks: { red: uniformDeck([9, 9, 9, 9]), blue: uniformDeck([1, 1, 1, 1]) },
      seed: 9,
    });
    const afterCapture = play(play(play(state, 0), 1), 2); // red takes blue's card at 1

    expect(computeScore(afterCapture)).toEqual({ red: 6, blue: 4 });
  });
});

describe('legalMoves', () => {
  it('lists every card in hand on every empty square', () => {
    const state = play(newGame(), 4);

    const moves = legalMoves(state);

    expect(moves).toHaveLength(state.players.blue.hand.length * 8);
    expect(moves.every((move) => move.player === 'blue' && move.position !== 4)).toBe(true);
  });
});

describe('playRandomMove', () => {
  it('plays a legal move for the active player', () => {
    const state = newGame();

    const result = playRandomMove(state);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players.red.placedCount).toBe(1);
    expect(result.state.activePlayer).toBe('blue');
  });

  it('is deterministic for a given state and advances the random state', () => {
    const state = newGame();
    const first = playRandomMove(state);
    const second = playRandomMove(state);

    expect(first).toEqual(second);
    expect(first.ok && first.state.rngState).not.toBe(state.rngState);
  });

  it('can play a whole game', () => {
    let state = newGame({ same: true, plus: true, combo: true, sameWall: true, elemental: 'all' });
    for (let turn = 0; turn < 9; turn++) {
      const result = playRandomMove(state);
      if (!result.ok) throw new Error(result.error);
      state = result.state;
    }

    expect(state.result).not.toBeNull();
    expect(playRandomMove(state)).toEqual({ ok: false, error: 'GAME_OVER' });
  });
});
