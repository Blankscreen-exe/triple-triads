import { describe, expect, it } from 'vitest';
import type { Board, CaptureEvent, PlayerColor } from '@triple-triad/engine';
import type { CardInfo, GameSnapshot, MatchSnapshot } from './realtime/protocol';
import {
  accumulateCaptures,
  computeGameStats,
  EMPTY_ACCUMULATOR,
  type CaptureAccumulator,
} from './game-stats';

function makeCard(id: string, stars: number): CardInfo {
  return {
    name: `Card ${id}`,
    stats: { top: 5, right: 5, bottom: 5, left: 5 },
    element: null,
    stars,
    artUrl: null,
  };
}

function makePlaced(id: string, owner: PlayerColor, controller: PlayerColor): Board[number] {
  return {
    element: null,
    placed: {
      instanceId: `${owner}-${id}`,
      card: { id, stats: { top: 5, right: 5, bottom: 5, left: 5 }, element: null },
      owner,
      controller,
    },
  };
}

function emptyCell(): Board[number] {
  return { element: null, placed: null };
}

const BASE_MATCH: MatchSnapshot = {
  format: 'until-winner',
  round: 1,
  roundResults: [],
  seriesScore: { red: 0, blue: 0 },
  nextRoundAt: null,
  cardsLeft: { red: 10, blue: 10 },
};

function makeSnapshot(overrides: {
  board?: Board;
  cards?: Record<string, CardInfo>;
  turn?: number;
  lastMove?: GameSnapshot['lastMove'];
  match?: MatchSnapshot;
}): GameSnapshot {
  const board = overrides.board ?? Array.from({ length: 9 }, emptyCell);
  return {
    view: {
      viewer: 'spectator',
      rules: {
        open: false,
        same: false,
        plus: false,
        combo: false,
        sameWall: false,
        elemental: 'off',
      },
      board,
      players: {
        red: { hand: { size: 0, cards: null }, drawPileSize: 0 },
        blue: { hand: { size: 0, cards: null }, drawPileSize: 0 },
      },
      activePlayer: 'red',
      turn: overrides.turn ?? 1,
      score: { red: 5, blue: 5 },
      result: null,
    },
    firstPlayer: { color: 'red', reason: 'coin-flip' },
    match: overrides.match ?? BASE_MATCH,
    players: {
      red: { userId: 'r', username: 'Red', connected: true, pack: 'classic' as never },
      blue: { userId: 'b', username: 'Blue', connected: true, pack: 'classic' as never },
    },
    cards: overrides.cards ?? {},
    lastMove: overrides.lastMove ?? null,
    turnDeadline: null,
    paused: null,
    forfeit: false,
    outcome: null,
  };
}

describe('accumulateCaptures', () => {
  it('accumulates capture events across moves', () => {
    const capture1: CaptureEvent = {
      position: 1,
      cause: 'basic',
      from: 'blue',
      to: 'red',
      wave: 0,
    };
    const capture2: CaptureEvent = { position: 3, cause: 'same', from: 'red', to: 'blue', wave: 0 };

    const snap1 = makeSnapshot({
      turn: 2,
      lastMove: { player: 'red', position: 0, captures: [capture1], timedOut: false },
    });
    const acc1 = accumulateCaptures(EMPTY_ACCUMULATOR, snap1);
    expect(acc1.events).toHaveLength(1);
    expect(acc1.firstBlood).toBe('red');

    const snap2 = makeSnapshot({
      turn: 3,
      lastMove: { player: 'blue', position: 2, captures: [capture2], timedOut: true },
    });
    const acc2 = accumulateCaptures(acc1, snap2);
    expect(acc2.events).toHaveLength(2);
    expect(acc2.timeouts.blue).toBe(1);
    expect(acc2.firstBlood).toBe('red');
  });

  it('does not double-count on the same turn', () => {
    const capture: CaptureEvent = { position: 1, cause: 'basic', from: 'blue', to: 'red', wave: 0 };
    const snap = makeSnapshot({
      turn: 2,
      lastMove: { player: 'red', position: 0, captures: [capture], timedOut: false },
    });
    const acc1 = accumulateCaptures(EMPTY_ACCUMULATOR, snap);
    const acc2 = accumulateCaptures(acc1, snap);
    expect(acc2.events).toHaveLength(1);
  });

  it('tracks longest combo chain', () => {
    const captures: CaptureEvent[] = [
      { position: 1, cause: 'same', from: 'blue', to: 'red', wave: 0 },
      { position: 2, cause: 'combo', from: 'blue', to: 'red', wave: 1 },
      { position: 3, cause: 'combo', from: 'blue', to: 'red', wave: 2 },
    ];
    const snap = makeSnapshot({
      turn: 2,
      lastMove: { player: 'red', position: 0, captures, timedOut: false },
    });
    const acc = accumulateCaptures(EMPTY_ACCUMULATOR, snap);
    expect(acc.longestComboChain).toEqual({ player: 'red', length: 2 });
  });
});

describe('computeGameStats', () => {
  it('computes per-player stats from the board', () => {
    const board: Board = [
      makePlaced('a', 'red', 'red'),
      makePlaced('b', 'red', 'blue'),
      makePlaced('c', 'blue', 'red'),
      makePlaced('d', 'blue', 'blue'),
      emptyCell(),
      emptyCell(),
      emptyCell(),
      emptyCell(),
      emptyCell(),
    ];
    const cards: Record<string, CardInfo> = {
      a: makeCard('a', 3),
      b: makeCard('b', 4),
      c: makeCard('c', 2),
      d: makeCard('d', 5),
    };
    const captures: CaptureEvent[] = [
      { position: 1, cause: 'basic', from: 'red', to: 'blue', wave: 0 },
      { position: 2, cause: 'basic', from: 'blue', to: 'red', wave: 0 },
    ];
    const acc: CaptureAccumulator = {
      events: captures,
      timeouts: { red: 0, blue: 1 },
      firstBlood: 'blue',
      longestComboChain: null,
      lastProcessedTurn: 4,
    };

    const snap = makeSnapshot({ board, cards, turn: 5 });
    const stats = computeGameStats(snap, acc);

    expect(stats.red.cardsCaptured).toBe(1);
    expect(stats.red.cardsLost).toBe(1);
    expect(stats.red.avgRarity).toBe(3.5);
    expect(stats.red.strongestCard).toEqual({ name: 'Card b', stars: 4 });
    expect(stats.red.captureEfficiency).toBe(0.5);
    expect(stats.red.timeouts).toBe(0);

    expect(stats.blue.cardsCaptured).toBe(1);
    expect(stats.blue.cardsLost).toBe(1);
    expect(stats.blue.avgRarity).toBe(3.5);
    expect(stats.blue.timeouts).toBe(1);
  });

  it('detects a sweep', () => {
    const board: Board = Array.from({ length: 9 }, (_, i) =>
      makePlaced(String(i), i < 5 ? 'red' : 'blue', 'red'),
    );
    const cards: Record<string, CardInfo> = {};
    for (let i = 0; i < 9; i++) cards[String(i)] = makeCard(String(i), 3);

    const snap = makeSnapshot({ board, cards, turn: 10 });
    const stats = computeGameStats(snap, EMPTY_ACCUMULATOR);
    expect(stats.endGame?.sweep).toBe('red');
    expect(stats.endGame?.shutout).toBeNull();
  });

  it('detects a shutout', () => {
    const board: Board = [
      makePlaced('0', 'red', 'red'),
      makePlaced('1', 'red', 'red'),
      makePlaced('2', 'red', 'red'),
      makePlaced('3', 'red', 'red'),
      makePlaced('4', 'red', 'red'),
      makePlaced('5', 'blue', 'blue'),
      makePlaced('6', 'blue', 'blue'),
      makePlaced('7', 'blue', 'blue'),
      makePlaced('8', 'blue', 'red'),
    ];
    const cards: Record<string, CardInfo> = {};
    for (let i = 0; i < 9; i++) cards[String(i)] = makeCard(String(i), 3);

    const snap = makeSnapshot({ board, cards, turn: 10 });
    const stats = computeGameStats(snap, EMPTY_ACCUMULATOR);
    expect(stats.endGame?.shutout).toBe('red');
    expect(stats.endGame?.sweep).toBeNull();
  });

  it('computes match-level rounds won from round results', () => {
    const match: MatchSnapshot = {
      ...BASE_MATCH,
      round: 3,
      roundResults: [
        { winner: null, score: { red: 5, blue: 5 } },
        { winner: 'red', score: { red: 6, blue: 4 } },
      ],
      seriesScore: { red: 1, blue: 0 },
    };
    const snap = makeSnapshot({ match });
    const stats = computeGameStats(snap, EMPTY_ACCUMULATOR);
    expect(stats.match.roundsWon).toEqual({ red: 1, blue: 0 });
  });
});
