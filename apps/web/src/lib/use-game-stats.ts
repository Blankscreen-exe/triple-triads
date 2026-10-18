'use client';

import { useState } from 'react';
import type { GameSnapshot } from './realtime/protocol';
import {
  accumulateCaptures,
  computeGameStats,
  EMPTY_ACCUMULATOR,
  type CaptureAccumulator,
  type GameStats,
} from './game-stats';

interface Tracked {
  /** The snapshot the totals were last updated from. */
  readonly game: GameSnapshot | null;
  readonly accumulator: CaptureAccumulator;
}

/**
 * Live stats for the game on screen. Captures are only reported move by move, so they are
 * accumulated across snapshots; the totals are updated while rendering when a new snapshot arrives
 * (React's "adjusting state when a prop changes"), avoiding an extra render from an effect.
 */
export function useGameStats(game: GameSnapshot | null): GameStats | null {
  const [tracked, setTracked] = useState<Tracked>({ game: null, accumulator: EMPTY_ACCUMULATOR });

  let { accumulator } = tracked;
  if (game !== tracked.game) {
    accumulator = game ? accumulateCaptures(tracked.accumulator, game) : EMPTY_ACCUMULATOR;
    setTracked({ game, accumulator });
  }

  return game ? computeGameStats(game, accumulator) : null;
}
