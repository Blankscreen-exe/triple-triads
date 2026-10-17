'use client';

import { useNow } from '@/lib/realtime/hooks';

interface CountdownProps {
  /** Server-clock deadline in ms. */
  readonly deadline: number;
  /** Server time minus local time. */
  readonly clockOffset: number;
  readonly className?: string;
}

/** Live "m:ss" countdown to a server-side deadline. */
export function Countdown({ deadline, clockOffset, className = '' }: CountdownProps) {
  const now = useNow(true) + clockOffset;
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <span className={`tabular-nums ${className}`} role="timer">
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
    </span>
  );
}
