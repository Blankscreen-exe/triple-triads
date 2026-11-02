/**
 * Pieces shared by the starter deck list and a starter deck's own page.
 */
import type { DeckRules } from '@triple-triad/engine';
import type { CSSProperties, ReactNode } from 'react';
import { CardView } from '@/components/cards/card-view';
import { ElementBadge } from '@/components/cards/element-badge';
import { toCardFace } from '@/components/cards/to-card-face';
import type { AssetPack } from '@/lib/asset-packs';
import { deckStats, MAX_STARS, type DeckStats } from '@/lib/deck-stats';
import type { StarterDeckSummary } from '@/server/catalog/starter-decks';

export function starterDeckStats(deck: StarterDeckSummary): DeckStats {
  return deckStats(
    deck.entries.map(({ card, quantity }) => ({
      stars: card.stars,
      score: card.score,
      element: card.element,
      quantity,
    })),
  );
}

export function StarterDeckBadges({ deck }: { readonly deck: StarterDeckSummary }) {
  const problems = deck.violations.length;
  return (
    <>
      {deck.isDefault && <Badge className="bg-action ring-1 ring-white/60">Default</Badge>}
      {problems === 0 ? (
        <Badge className="bg-status-open/70">Ready</Badge>
      ) : (
        <Badge className="bg-status-live/70">
          {`${String(problems)} ${problems === 1 ? 'problem' : 'problems'}`}
        </Badge>
      )}
    </>
  );
}

function Badge({ className, children }: { readonly className: string; readonly children: string }) {
  return (
    <span
      className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${className}`}
    >
      {children}
    </span>
  );
}

/** How many cards the fan shows. */
const FAN_SIZE = 5;
/** Degrees each card turns, and pixels it drops, per step away from the middle. */
const FAN_TURN = 7;
const FAN_DROP = 5;

/**
 * The deck's strongest cards fanned out like a hand, the strongest in the middle and on top.
 * Decorative: the deck's name and numbers sit beside it.
 */
export function CardFan({
  deck,
  pack,
}: {
  readonly deck: StarterDeckSummary;
  readonly pack: AssetPack;
}) {
  const cards = deck.entries.slice(0, FAN_SIZE).map((entry) => entry.card);
  if (cards.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-frame/40 text-sm text-slate-300/80">
        No cards yet
      </div>
    );
  }
  // Slots from left to right, offset from the middle; the strongest cards take the middle ones.
  const middle = (cards.length - 1) / 2;
  const slots = cards
    .map((_, slot) => slot - middle)
    .toSorted((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  return (
    <div aria-hidden className="flex h-36 items-start justify-center pt-1">
      {cards
        .map((card, rank) => ({ card, rank, offset: slots[rank] ?? 0 }))
        .toSorted((a, b) => a.offset - b.offset)
        .map(({ card, rank, offset }) => (
          <div
            key={card.id}
            className="-mx-4 w-[4.75rem] shrink-0 origin-bottom drop-shadow-[0_4px_6px_rgb(0_0_0/0.5)]"
            style={
              {
                zIndex: FAN_SIZE - rank,
                transform: `translateY(${String(Math.abs(offset) * FAN_DROP)}px) rotate(${String(offset * FAN_TURN)}deg)`,
              } satisfies CSSProperties
            }
          >
            <CardView card={toCardFace(card)} side="blue" pack={pack} />
          </div>
        ))}
    </div>
  );
}

/** The deck's elements in their colours, with how many cards have each. */
export function ElementCounts({
  stats,
  compact = false,
}: {
  readonly stats: DeckStats;
  readonly compact?: boolean;
}) {
  const plain = stats.cards - stats.elementalCards;
  if (stats.byElement.length === 0) {
    return <p className="text-xs text-slate-300/80">No elements</p>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Elements">
      {stats.byElement.map(({ element, count }) => (
        <li key={element}>
          <ElementBadge element={element} count={count} compact={compact} />
        </li>
      ))}
      {!compact && plain > 0 && (
        <li className="rounded-full px-2 py-0.5 text-xs text-slate-300 ring-1 ring-slate-400/40">
          No element ×{plain}
        </li>
      )}
    </ul>
  );
}

/** Key numbers, as label and value pairs. */
export function DeckNumbers({
  stats,
  deckSize,
  narrow = false,
}: {
  readonly stats: DeckStats;
  readonly deckSize: number;
  /** Two columns at every width, for a sidebar. */
  readonly narrow?: boolean;
}) {
  return (
    <dl className={`grid grid-cols-2 gap-x-4 gap-y-2 text-sm ${narrow ? '' : 'sm:grid-cols-4'}`}>
      <Metric label="Cards" warn={stats.cards !== deckSize}>
        {stats.cards} / {deckSize}
      </Metric>
      <Metric label="Average">
        {stats.averageStars === null ? '–' : `${stats.averageStars.toFixed(1)}★`}
      </Metric>
      <Metric label="Strength">{stats.totalScore.toLocaleString('en')}</Metric>
      <Metric label="Elemental">
        {stats.elementalCards} / {stats.cards}
      </Metric>
    </dl>
  );
}

function Metric({
  label,
  warn = false,
  children,
}: {
  readonly label: string;
  readonly warn?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] tracking-wider text-slate-300/80 uppercase">{label}</dt>
      <dd
        className={`font-semibold whitespace-nowrap tabular-nums ${warn ? 'text-score-red' : 'text-cream'}`}
      >
        {children}
      </dd>
    </div>
  );
}

/**
 * Cards per star rank as bars, longest for the most common rank, with the deck rules' limit for
 * each rank that has one.
 */
export function StarBars({
  stats,
  rules,
}: {
  readonly stats: DeckStats;
  readonly rules: DeckRules;
}) {
  const ranks = Array.from({ length: MAX_STARS }, (_, index) => MAX_STARS - index);
  const longest = Math.max(1, ...stats.byStars);
  return (
    <ul className="space-y-1.5" aria-label="Cards by stars">
      {ranks.map((stars) => {
        const count = stats.byStars[stars - 1] ?? 0;
        const cap = rules.starCaps[stars];
        const over = cap !== undefined && count > cap;
        return (
          <li key={stars} className="flex items-center gap-2 text-sm">
            <span
              className="w-20 shrink-0 tracking-tight text-amber-300"
              aria-label={`${String(stars)} stars`}
            >
              {'★'.repeat(stars)}
            </span>
            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-black/40">
              <span
                className={`block h-full rounded-full ${over ? 'bg-status-live' : 'bg-amber-300/80'}`}
                style={{ width: `${String((count / longest) * 100)}%` }}
              />
            </span>
            <span
              className={`w-14 shrink-0 text-right whitespace-nowrap tabular-nums ${over ? 'text-score-red' : 'text-slate-200'}`}
            >
              {count}
              {cap !== undefined && <span className="text-slate-400"> / {cap}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
