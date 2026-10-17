import type { CaptureCause } from '@triple-triad/engine';
import type { GameSnapshot } from '@/lib/realtime/protocol';

const ANNOUNCED: readonly CaptureCause[] = ['same', 'plus', 'combo'];
const LABELS: Record<CaptureCause, string> = {
  basic: '',
  same: 'Same!',
  plus: 'Plus!',
  combo: 'Combo!',
};

/** FF8-style announcement when Same, Plus or Combo captured cards on the last move. */
export function CaptureBanner({ game }: { readonly game: GameSnapshot }) {
  const causes = new Set(game.lastMove?.captures.map((capture) => capture.cause));
  const labels = ANNOUNCED.filter((cause) => causes.has(cause)).map((cause) => LABELS[cause]);
  if (labels.length === 0) return null;

  return (
    <div
      // Keyed by turn so each move's announcement replays the animation.
      key={game.view.turn}
      role="status"
      className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center gap-4 motion-safe:animate-banner"
    >
      {labels.map((label) => (
        <span
          key={label}
          className="font-display text-4xl font-black tracking-widest text-cream [text-shadow:0_3px_0_#000,0_0_18px_rgb(58_111_216/0.9)] sm:text-5xl"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
