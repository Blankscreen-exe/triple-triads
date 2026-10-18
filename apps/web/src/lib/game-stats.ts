import type { Board, CaptureEvent, CaptureCause, PlayerColor } from '@triple-triad/engine';
import type { CardInfo, GameSnapshot, MatchSnapshot } from './realtime/protocol';

export interface CapturesByType {
  readonly basic: number;
  readonly same: number;
  readonly plus: number;
  readonly combo: number;
}

const EMPTY_CAPTURES_BY_TYPE: CapturesByType = { basic: 0, same: 0, plus: 0, combo: 0 };

export interface PlayerStats {
  readonly cardsCaptured: number;
  readonly cardsLost: number;
  readonly captureEfficiency: number | null;
  readonly avgRarity: number | null;
  readonly strongestCard: { readonly name: string; readonly stars: number } | null;
  readonly timeouts: number;
}

export interface UnifiedStats {
  readonly capturesByType: CapturesByType;
  readonly longestComboChain: { readonly player: PlayerColor; readonly length: number } | null;
  readonly firstBlood: PlayerColor | null;
}

export interface EndGameStats {
  readonly shutout: PlayerColor | null;
  readonly sweep: PlayerColor | null;
}

export interface MatchLevelStats {
  readonly roundsWon: Readonly<Record<PlayerColor, number>>;
  readonly cardsRemaining: Readonly<Record<PlayerColor, number>>;
}

export interface GameStats {
  readonly red: PlayerStats;
  readonly blue: PlayerStats;
  readonly unified: UnifiedStats;
  readonly endGame: EndGameStats | null;
  readonly match: MatchLevelStats;
}

export interface CaptureAccumulator {
  readonly events: readonly CaptureEvent[];
  readonly timeouts: Readonly<Record<PlayerColor, number>>;
  readonly firstBlood: PlayerColor | null;
  readonly longestComboChain: { readonly player: PlayerColor; readonly length: number } | null;
  /** The turn of the last move we processed, to avoid double-counting. */
  readonly lastProcessedTurn: number;
}

export const EMPTY_ACCUMULATOR: CaptureAccumulator = {
  events: [],
  timeouts: { red: 0, blue: 0 },
  firstBlood: null,
  longestComboChain: null,
  lastProcessedTurn: 0,
};

export function accumulateCaptures(
  prev: CaptureAccumulator,
  game: GameSnapshot,
): CaptureAccumulator {
  const { lastMove, view } = game;
  if (!lastMove || view.turn <= prev.lastProcessedTurn) return prev;

  const events = [...prev.events, ...lastMove.captures];
  const timeouts = { ...prev.timeouts };
  if (lastMove.timedOut) {
    timeouts[lastMove.player] = timeouts[lastMove.player] + 1;
  }

  const firstCapture = lastMove.captures[0];
  const firstBlood = prev.firstBlood ?? (firstCapture ? firstCapture.to : null);

  let longestComboChain = prev.longestComboChain;
  const maxWave = lastMove.captures.reduce((max, c) => Math.max(max, c.wave), 0);
  if (maxWave > 0) {
    if (!longestComboChain || maxWave > longestComboChain.length) {
      longestComboChain = { player: lastMove.player, length: maxWave };
    }
  }

  return {
    events,
    timeouts,
    firstBlood,
    longestComboChain,
    lastProcessedTurn: view.turn,
  };
}

function computePlayerStats(
  color: PlayerColor,
  board: Board,
  cards: Readonly<Record<string, CardInfo>>,
  accumulator: CaptureAccumulator,
): PlayerStats {
  const captured = accumulator.events.filter((e) => e.to === color).length;
  const lost = accumulator.events.filter((e) => e.from === color).length;

  const placedCards = board
    .filter((cell) => cell.placed?.owner === color)
    .map((cell) => cell.placed!);
  const placedCount = placedCards.length;

  let starTotal = 0;
  let strongestCard: { name: string; stars: number } | null = null;
  for (const placed of placedCards) {
    const info = cards[placed.card.id];
    if (!info) continue;
    starTotal += info.stars;
    if (!strongestCard || info.stars > strongestCard.stars) {
      strongestCard = { name: info.name, stars: info.stars };
    }
  }

  return {
    cardsCaptured: captured,
    cardsLost: lost,
    captureEfficiency: placedCount > 0 ? captured / placedCount : null,
    avgRarity: placedCount > 0 ? starTotal / placedCount : null,
    strongestCard,
    timeouts: accumulator.timeouts[color],
  };
}

function computeUnifiedStats(accumulator: CaptureAccumulator): UnifiedStats {
  const capturesByType = { ...EMPTY_CAPTURES_BY_TYPE };
  for (const event of accumulator.events) {
    capturesByType[event.cause] += 1;
  }
  return {
    capturesByType,
    longestComboChain: accumulator.longestComboChain,
    firstBlood: accumulator.firstBlood,
  };
}

function computeEndGameStats(board: Board): EndGameStats | null {
  const filled = board.filter((cell) => cell.placed !== null);
  if (filled.length < board.length) return null;

  const redControlled = filled.filter((cell) => cell.placed!.controller === 'red').length;
  const blueControlled = filled.length - redControlled;

  const redOwned = filled.filter((cell) => cell.placed!.owner === 'red').length;
  const blueOwned = filled.length - redOwned;

  const redLost = filled.filter(
    (cell) => cell.placed!.owner === 'red' && cell.placed!.controller === 'blue',
  ).length;
  const blueLost = filled.filter(
    (cell) => cell.placed!.owner === 'blue' && cell.placed!.controller === 'red',
  ).length;

  const shutout =
    redLost === 0 && blueOwned > 0 && redControlled > blueControlled
      ? 'red'
      : blueLost === 0 && redOwned > 0 && blueControlled > redControlled
        ? 'blue'
        : null;

  const sweep =
    redControlled === filled.length
      ? 'red'
      : blueControlled === filled.length
        ? 'blue'
        : null;

  return { shutout: sweep ? null : shutout, sweep };
}

function computeMatchStats(match: MatchSnapshot): MatchLevelStats {
  return {
    roundsWon: { ...match.seriesScore },
    cardsRemaining: match.cardsLeft,
  };
}

export function computeGameStats(
  game: GameSnapshot,
  accumulator: CaptureAccumulator,
): GameStats {
  return {
    red: computePlayerStats('red', game.view.board, game.cards, accumulator),
    blue: computePlayerStats('blue', game.view.board, game.cards, accumulator),
    unified: computeUnifiedStats(accumulator),
    endGame: computeEndGameStats(game.view.board),
    match: computeMatchStats(game.match),
  };
}
