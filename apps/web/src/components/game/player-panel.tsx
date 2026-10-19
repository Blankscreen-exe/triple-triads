import type { PlayerColor } from '@triple-triad/engine';

interface PlayerPanelProps {
  readonly username: string;
  readonly color: PlayerColor;
  readonly score: number;
  readonly drawPileSize: number;
  readonly connected: boolean;
  readonly isYou: boolean;
  readonly isActive: boolean;
  /** On phones, squeeze everything into one line (for the panel above your hand). */
  readonly slim?: boolean;
}

const COLOR_STYLES: Record<PlayerColor, { badge: string; score: string }> = {
  red: { badge: 'bg-status-live', score: 'text-score-red' },
  blue: { badge: 'bg-action', score: 'text-score-blue' },
};

export function PlayerPanel({
  username,
  color,
  score,
  drawPileSize,
  connected,
  isYou,
  isActive,
  slim = false,
}: PlayerPanelProps) {
  const styles = COLOR_STYLES[color];
  return (
    <div
      role="group"
      aria-label={`${username} (${color})`}
      className={`rounded-md border bg-black/25 px-3 ${slim ? 'flex items-center gap-3 py-1 sm:block sm:py-2' : 'py-2'} ${isActive ? 'border-cream shadow-[0_0_12px_rgb(244_236_210/0.35)]' : 'border-frame/40'}`}
    >
      <div
        className={`flex min-w-0 items-center justify-between gap-2 ${slim ? 'flex-1 sm:flex-none' : ''}`}
      >
        <span className="truncate font-semibold text-slate-100" title={username}>
          {username}
        </span>
        <span
          className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${styles.badge}`}
        >
          {color}
        </span>
      </div>
      <div
        className={`flex items-end justify-between ${slim ? 'gap-3 max-sm:items-center sm:mt-1' : 'mt-1'}`}
      >
        <span className="text-xs text-slate-300/70">
          {isYou && (
            <span
              className={`font-semibold text-cream ${slim ? 'mr-2 sm:mr-0 sm:block' : 'block'}`}
            >
              You
            </span>
          )}
          Deck {drawPileSize}
          {!connected && <span className="ml-2 text-status-live">● offline</span>}
        </span>
        <span
          className={`font-display text-3xl leading-none font-black sm:text-4xl [text-shadow:0_3px_0_#000] ${styles.score}`}
          aria-label={`Score ${String(score)}`}
        >
          {score}
        </span>
      </div>
    </div>
  );
}
