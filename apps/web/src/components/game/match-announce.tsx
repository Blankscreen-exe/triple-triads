'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlayerColor } from '@triple-triad/engine';

type Outcome = 'victory' | 'defeat' | 'draw';

interface MatchAnnounceProps {
  readonly winner: PlayerColor | null;
  readonly you: PlayerColor | null;
  readonly finished: boolean;
}

const STYLE: Record<Outcome, string> = {
  victory: 'text-gold',
  defeat: 'text-score-red',
  draw: 'text-slate-300',
};

export function MatchAnnounce({ winner, you, finished }: MatchAnnounceProps) {
  const [visible, setVisible] = useState<Outcome | null>(null);
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter');
  const shown = useRef(false);

  useEffect(() => {
    if (!finished || shown.current) return;
    shown.current = true;

    const outcome: Outcome =
      winner === null ? 'draw' : you === winner ? 'victory' : you === null ? 'draw' : 'defeat';

    setPhase('enter');
    setVisible(outcome);

    const exitTimer = setTimeout(() => setPhase('exit'), 1800);
    const hideTimer = setTimeout(() => setVisible(null), 2600);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, [finished, winner, you]);

  if (visible === null) return null;

  const label = visible === 'victory' ? 'Victory' : visible === 'defeat' ? 'Defeat' : 'Draw';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      aria-live="assertive"
    >
      <h2
        className={`font-display text-6xl font-black tracking-[0.3em] uppercase sm:text-8xl [text-shadow:0_4px_16px_rgba(0,0,0,0.9),0_2px_0_#000] ${STYLE[visible]} ${
          phase === 'enter' ? 'animate-round-enter' : 'animate-round-exit'
        }`}
      >
        {label}
      </h2>
    </div>
  );
}
