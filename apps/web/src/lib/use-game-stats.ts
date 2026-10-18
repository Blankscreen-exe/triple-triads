'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameSnapshot } from './realtime/protocol';
import {
  accumulateCaptures,
  computeGameStats,
  EMPTY_ACCUMULATOR,
  type CaptureAccumulator,
  type GameStats,
} from './game-stats';

export function useGameStats(game: GameSnapshot | null): GameStats | null {
  const accRef = useRef<CaptureAccumulator>(EMPTY_ACCUMULATOR);
  const [stats, setStats] = useState<GameStats | null>(null);

  useEffect(() => {
    if (!game) {
      accRef.current = EMPTY_ACCUMULATOR;
      setStats(null);
      return;
    }

    accRef.current = accumulateCaptures(accRef.current, game);
    setStats(computeGameStats(game, accRef.current));
  }, [game]);

  return stats;
}
