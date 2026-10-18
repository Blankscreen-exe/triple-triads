'use client';

import { useEffect, useRef, useState } from 'react';

interface RoundAnnounceProps {
  readonly round: number;
  readonly turn: number;
}

export function RoundAnnounce({ round, turn }: RoundAnnounceProps) {
  const [visible, setVisible] = useState<number | null>(() => (turn <= 1 ? round : null));
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter');
  const prevRound = useRef(round);

  useEffect(() => {
    if (visible !== null) {
      const exitTimer = setTimeout(() => {
        setPhase('exit');
      }, 1200);
      const hideTimer = setTimeout(() => {
        setVisible(null);
      }, 2000);
      return () => {
        clearTimeout(exitTimer);
        clearTimeout(hideTimer);
      };
    }
    return undefined;
  }, [visible]);

  useEffect(() => {
    if (round !== prevRound.current) {
      prevRound.current = round;
      setPhase('enter');
      setVisible(round);
    }
  }, [round]);

  if (visible === null) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      aria-live="assertive"
    >
      <h2
        className={`font-display text-5xl font-black tracking-[0.3em] text-cream uppercase sm:text-7xl [text-shadow:0_4px_12px_rgba(0,0,0,0.8),0_2px_0_#000] ${
          phase === 'enter' ? 'animate-round-enter' : 'animate-round-exit'
        }`}
      >
        Round {visible}
      </h2>
    </div>
  );
}
