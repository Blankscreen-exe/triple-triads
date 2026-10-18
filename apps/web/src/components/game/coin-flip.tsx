'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlayerColor } from '@triple-triad/engine';

interface CoinFlipProps {
  readonly winnerColor: PlayerColor;
  readonly winnerName: string;
  readonly round: number;
  readonly turn: number;
  readonly reason: string;
}

export function CoinFlip({ winnerColor, winnerName, round, turn, reason }: CoinFlipProps) {
  const [phase, setPhase] = useState<'idle' | 'spin' | 'result' | 'exit' | null>(null);
  const shown = useRef(false);

  useEffect(() => {
    if (reason !== 'coin-flip' || round !== 1 || turn !== 1 || shown.current) return;
    shown.current = true;
    setPhase('spin');
    const resultTimer = setTimeout(() => setPhase('result'), 1900);
    const exitTimer = setTimeout(() => setPhase('exit'), 3400);
    const hideTimer = setTimeout(() => setPhase(null), 4100);
    return () => {
      clearTimeout(resultTimer);
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, [reason, round, turn]);

  if (phase === null || phase === 'idle') return null;

  const color = winnerColor === 'red' ? 'text-score-red' : 'text-score-blue';

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 transition-opacity duration-700 ${phase === 'exit' ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* Coin */}
      <div
        className="motion-safe:animate-coin-spin"
        style={{ perspective: '800px' }}
      >
        <div className="flex size-24 items-center justify-center rounded-full border-4 border-gold bg-gradient-to-b from-gold-light to-gold shadow-[0_0_30px_rgba(201,178,122,0.4),inset_0_2px_4px_rgba(255,255,255,0.3)] sm:size-28">
          <span className="font-display text-4xl font-black text-ink sm:text-5xl">TT</span>
        </div>
      </div>

      {/* Result text */}
      {(phase === 'result' || phase === 'exit') && (
        <div className="motion-safe:animate-coin-result text-center">
          <p className={`font-display text-2xl font-black tracking-[0.15em] uppercase sm:text-3xl ${color} [text-shadow:0_3px_8px_rgba(0,0,0,0.8),0_2px_0_#000]`}>
            {winnerName}
          </p>
          <p className="mt-1 text-sm text-slate-300/80">goes first</p>
        </div>
      )}
    </div>
  );
}
