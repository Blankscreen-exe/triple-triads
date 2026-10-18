import {
  DEFAULT_DECK_RULES,
  MAX_NORMAL_ELEMENTAL_CELLS,
  maxRounds,
  MIN_CARDS_PER_GAME,
  rankCard,
  STARTING_SCORE,
  type Element,
  type RuleSet,
} from '@triple-triad/engine';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { cache, Suspense, type ReactNode } from 'react';
import { CardView, type CardFace } from '@/components/cards/card-view';
import { ElementIcon } from '@/components/game/element-icon';
import { Window } from '@/components/ui/window';
import { ELEMENT_LABELS, formatStat } from '@/lib/elements';
import { STARTING_RATING, TIERS } from '@/lib/rating';
import {
  MATCH_FORMAT_LABELS,
  RECONNECT_GRACE_MS,
  REMATCH_VOTE_MS,
  ROUND_BREAK_MS,
  TURN_TIMER_OPTIONS,
} from '@/lib/realtime/protocol';
import type { LockableOption } from '@/lib/validation/settings';
import { getDatabase } from '@/server/db';
import { getGameSettings } from '@/server/settings/settings';

export const metadata: Metadata = { title: 'How to play' };

/** Every deck has this many cards (deck rules), which sets how long a match can last. */
const DECK_SIZE = DEFAULT_DECK_RULES.size;
const MAX_ROUNDS = maxRounds(DECK_SIZE);

const SECTIONS = [
  { id: 'cards', title: 'Cards' },
  { id: 'decks', title: 'Decks' },
  { id: 'playing', title: 'Playing a game' },
  { id: 'rules', title: 'Room rules' },
  { id: 'winning', title: 'Winning' },
  { id: 'after', title: 'After a match' },
  { id: 'rating', title: 'Rating' },
] as const;

/** The card used in the examples; its stars come from the current score table. */
const SAMPLE_CARD: Omit<CardFace, 'stars'> = {
  name: 'Sky Wyrm',
  stats: { top: 10, right: 4, bottom: 6, left: 9 },
  element: 'wind',
  artUrl: null,
};

/** Admin-editable settings, read once per request. Dynamic, so they are never baked into the build. */
const loadSettings = cache(async () => {
  await connection();
  return getGameSettings(getDatabase());
});

const seconds = (ms: number) => ms / 1000;

export default function RulesPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream">How to play</h1>
      <p className="mt-1 text-slate-300/80">
        Triple Triad is played on a 3 × 3 board. Take turns placing cards; a card you place can
        capture your opponent&apos;s cards next to it. Control the most cards when the board is full
        to win.
      </p>

      <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-2 text-sm">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded border border-frame/50 bg-black/20 px-2.5 py-1 text-slate-200 hover:bg-white/10"
          >
            {section.title}
          </a>
        ))}
      </nav>

      <div className="mt-6 space-y-6">
        <Section id="cards" title="Cards">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="w-40 shrink-0">
              <Suspense fallback={<div className="aspect-5/7" />}>
                <SampleCard />
              </Suspense>
            </div>
            <div className="space-y-3">
              <p>
                Each card has four numbers, one for each side: top, left, right and bottom. They go
                from 1 to 9, and <strong>A means 10</strong>. The sample card is strong at the top
                (A) and left (9) and weak on the right (4).
              </p>
              <p>
                A card may have one of eight <strong>elements</strong>, shown at its top right. They
                only matter on boards with elemental squares (see{' '}
                <a href="#elemental" className="underline">
                  Elemental
                </a>
                ).
              </p>
              <ul className="flex flex-wrap gap-3" aria-label="Elements">
                {(Object.entries(ELEMENT_LABELS) as [Element, string][]).map(([element, label]) => (
                  <li key={element} className="flex items-center gap-1.5 text-sm">
                    {/* The icon's own label would repeat the text next to it. */}
                    <span aria-hidden className="flex">
                      <ElementIcon element={element} className="size-6" />
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
              <p>
                The <strong>stars</strong> under the name rank a card&apos;s overall strength. They
                limit how many strong cards a deck can hold.
              </p>
            </div>
          </div>
          <Suspense fallback={<Loading />}>
            <StarScoring />
          </Suspense>
        </Section>

        <Section id="decks" title="Decks">
          <p>
            Everything you own is in your <strong>trunk</strong>: the starter decks every player
            receives, plus unlimited copies of the cards you make in the card maker. Build decks
            from your trunk in the deck editor and pick one when you join a room.
          </p>
          <Suspense fallback={<Loading />}>
            <DeckLimits />
          </Suspense>
          <p className="text-sm text-slate-300/80">
            Cards are never won or lost in a match: your trunk only changes when you make or delete
            cards.
          </p>
        </Section>

        <Section id="playing" title="Playing a game">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              A player creates a <strong>room</strong> in the lobby, chooses its rules and picks
              their colour, <span className="font-semibold text-score-red">red</span> or{' '}
              <span className="font-semibold text-score-blue">blue</span>. A second player joins and
              plays the other colour. Rooms can have a password, and can allow spectators.
            </li>
            <li>
              Both decks are shuffled and each player <strong>draws 3 cards</strong>. A{' '}
              <strong>coin flip</strong> decides who goes first.
            </li>
            <li>
              On every turn, including the first, you <strong>draw 1 card, then place 1</strong> on
              an empty square: drag the card onto the square, or click the card and then the square.
              Play alternates until all 9 squares are full: the first player places 5 cards and the
              second places 4.
            </li>
            <li>
              Rooms can have a <strong>turn timer</strong> (
              {TURN_TIMER_OPTIONS.map((option) =>
                option === null ? 'or none' : `${String(option)} seconds`,
              ).join(', ')}
              ). If your time runs out, a random card from your hand is placed on a random empty
              square.
            </li>
          </ol>
          <h3 className="pt-2 font-semibold text-cream">Capturing</h3>
          <p>
            When you place a card, compare each of its sides with the touching side of each
            neighbouring card your opponent controls. Wherever{' '}
            <strong>your number is higher</strong>, that card is captured and turns your colour.
          </p>
          <Example>
            You place a card with <Stat value={7} /> on its right. The card to its right belongs to
            your opponent and has <Stat value={5} /> on its left. 7 beats 5, so you capture it. A
            tie (7 against 7) captures nothing.
          </Example>
        </Section>

        <Section id="rules" title="Room rules">
          <p>
            The room&apos;s creator turns these rules on or off. The rules in play are shown at the
            top of the game. Same, Plus and Combo can capture several cards with one move, and work
            alongside the basic rule.
          </p>
          <Suspense fallback={<Loading />}>
            <RuleList />
          </Suspense>
        </Section>

        <Section id="winning" title="Winning">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              The score starts at{' '}
              <strong>
                {STARTING_SCORE}–{STARTING_SCORE}
              </strong>
              . Each capture moves one point from the player who lost the card to the player who
              took it.
            </li>
            <li>
              When the board is full, each player scores the cards they control on the board, and
              the <strong>second player gets 1 extra point</strong> for the card they did not get to
              place. The scores always add up to 10.
            </li>
            <li>
              The higher score wins the round.{' '}
              <strong>
                {STARTING_SCORE}–{STARTING_SCORE}
              </strong>{' '}
              is a draw.
            </li>
          </ul>
          <h3 className="pt-2 font-semibold text-cream">Matches and rounds</h3>
          <Suspense fallback={<Loading />}>
            <MatchFormatBadge />
          </Suspense>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              In rooms set to <strong>Until there is a winner</strong>, a drawn round is followed by
              another after a {seconds(ROUND_BREAK_MS)}-second break, until someone wins.
            </li>
            <li>
              <strong>Cards you place are used up</strong> for the rest of the match, even if they
              were captured; cards you drew but did not place go back into your deck. Spending your
              best cards early can leave you short later.
            </li>
            <li>
              After a drawn round, <strong>the other player starts</strong> the next one.
            </li>
            <li>
              Each round needs {MIN_CARDS_PER_GAME} cards per player, so a {DECK_SIZE}-card deck
              lasts up to {MAX_ROUNDS} rounds. If every round is drawn, the match is a draw.
            </li>
            <li>
              In <strong>Single game</strong> rooms the match is one round, so {STARTING_SCORE}–
              {STARTING_SCORE} is a draw. There is no Sudden Death.
            </li>
          </ul>
        </Section>

        <Section id="after" title="After a match">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Once a match is decided, both players vote to <strong>play again</strong> or{' '}
              <strong>leave</strong> within {seconds(REMATCH_VOTE_MS)} seconds; not voting counts as
              leaving. If both play again, a new match starts with full decks and the same rules.
            </li>
            <li>
              The <strong>loser starts</strong> the next match. After a drawn match, the player who
              started it starts again. Colours stay the same in every match.
            </li>
            <li>To change decks, leave the room and join or create another.</li>
            <li>
              If a player disconnects, the game pauses for up to {seconds(RECONNECT_GRACE_MS) / 60}{' '}
              minutes. If they do not come back, they lose the match.
            </li>
          </ul>
        </Section>

        <Section id="rating" title="Rating">
          <p>
            Everyone starts at a rating of <strong>{STARTING_RATING}</strong>. Winning raises your
            rating and losing lowers it, by more when the result is a surprise (beating a
            higher-rated player gains more than beating a lower-rated one). Ratings count matches,
            not rounds, and drawn matches change nothing.
          </p>
          <table className="w-full max-w-sm text-sm">
            <thead>
              <tr className="text-left text-slate-300/80">
                <th className="py-1 font-normal">Tier</th>
                <th className="py-1 font-normal">Rating</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map((tier, index) => {
                const next = TIERS[index + 1];
                return (
                  <tr key={tier.name} className="border-t border-frame/20">
                    <td className="py-1.5 text-slate-100">{tier.name}</td>
                    <td className="py-1.5 tabular-nums">
                      {next === undefined
                        ? `${String(tier.min)} and above`
                        : tier.min === -Infinity
                          ? `below ${String(next.min)}`
                          : `${String(tier.min)}–${String(next.min - 1)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-sm text-slate-300/80">
            Each tier below Diamond has three divisions, III, II and I, from lowest to highest. Your
            current winning or losing streak is shown next to your rating.
          </p>
        </Section>
      </div>
    </main>
  );
}

async function SampleCard() {
  const { scoring } = await loadSettings();
  const { stars } = rankCard(SAMPLE_CARD.stats, SAMPLE_CARD.element, scoring);
  return <CardView card={{ ...SAMPLE_CARD, stars }} side="blue" />;
}

/** Whether new rooms play until a winner on this server (an admin setting). */
async function MatchFormatBadge() {
  const { roomPolicy } = await loadSettings();
  const format = MATCH_FORMAT_LABELS[roomPolicy.defaults.format];
  return roomPolicy.locked.includes('format') ? (
    <p className="text-sm text-slate-300">
      Every room on this server plays <strong>{format}</strong>.
    </p>
  ) : (
    <p className="text-sm text-slate-300">
      New rooms play <strong>{format}</strong> unless their creator changes it.
    </p>
  );
}

async function StarScoring() {
  const { scoring } = await loadSettings();
  const sample = rankCard(SAMPLE_CARD.stats, SAMPLE_CARD.element, scoring);
  const values = Object.entries(scoring.statScores).map(([value, score]) => ({
    value: Number(value),
    score,
  }));
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-cream">How stars are counted</h3>
      <p>
        Each number on a card is worth some points. Add up the four numbers&apos; points, add{' '}
        <strong>{scoring.elementBonus}</strong> if the card has an element, then divide by 100 and
        round to the nearest whole number. Cards get at least 1 star, and a card worth more than{' '}
        {scoring.maxStars} stars cannot be made.
      </p>
      <div className="overflow-x-auto">
        <table className="text-sm tabular-nums">
          <tbody>
            <tr>
              <th scope="row" className="pr-3 text-left font-normal text-slate-300/80">
                Number
              </th>
              {values.map(({ value }) => (
                <td key={value} className="px-2 py-1 text-center font-semibold text-slate-100">
                  {formatStat(value)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-frame/20">
              <th scope="row" className="pr-3 text-left font-normal text-slate-300/80">
                Points
              </th>
              {values.map(({ value, score }) => (
                <td key={value} className="px-2 py-1 text-center">
                  {score}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <Example>
        The sample card (A, 4, 6, 9 and Wind) is worth {sample.score} points, so it has{' '}
        {sample.stars} {sample.stars === 1 ? 'star' : 'stars'}.
      </Example>
    </div>
  );
}

async function DeckLimits() {
  const { scoring, deckRules } = await loadSettings();
  return (
    <ul className="list-disc space-y-2 pl-5">
      <li>
        A deck has exactly <strong>{deckRules.size} cards</strong>.
      </li>
      <li>
        At most <strong>{deckRules.maxCopies} cards with the same numbers and element</strong>,
        whatever their names or art. A-4-6-9 and 9-A-4-6 count as different cards.
      </li>
      <li>Limits on strong cards: {describeStarCaps(deckRules.starCaps, scoring.maxStars)}.</li>
      <li>The deck editor shows what to fix when a deck breaks a rule.</li>
    </ul>
  );
}

/** E.g. "5★ at most 1, 4★ at most 3, 3★ at most 6; 1★ and 2★ unlimited". */
function describeStarCaps(
  starCaps: Readonly<Partial<Record<number, number>>>,
  maxStars: number,
): string {
  const ranks = Array.from({ length: maxStars }, (_, index) => maxStars - index);
  const capped = ranks.flatMap((stars) => {
    const cap = starCaps[stars];
    return cap === undefined ? [] : [`${String(stars)}★ at most ${String(cap)}`];
  });
  const unlimited = ranks
    .filter((stars) => starCaps[stars] === undefined)
    .reverse()
    .map((stars) => `${String(stars)}★`);
  const free =
    unlimited.length === 0
      ? []
      : [
          `${unlimited.slice(0, -1).join(', ')}${unlimited.length > 1 ? ' and ' : ''}${unlimited.at(-1) ?? ''} unlimited`,
        ];
  return [capped.join(', '), ...free].filter(Boolean).join('; ');
}

const RULES: readonly {
  readonly option: keyof RuleSet;
  readonly title: string;
  readonly body: ReactNode;
}[] = [
  {
    option: 'open',
    title: 'Open hands',
    body: <p>Both players can see each other&apos;s hands. Draw piles stay hidden.</p>,
  },
  {
    option: 'same',
    title: 'Same',
    body: (
      <>
        <p>
          If the card you place has the <strong>same number</strong> as the touching side of{' '}
          <strong>two or more</strong> neighbours, your opponent&apos;s cards among them are
          captured. Your own cards count towards the two.
        </p>
        <Example>
          You place a card with <Stat value={5} /> on top and <Stat value={3} /> on its right. The
          card above has <Stat value={5} /> at its bottom and the card to the right has{' '}
          <Stat value={3} /> on its left: both match, so both are captured.
        </Example>
      </>
    ),
  },
  {
    option: 'sameWall',
    title: 'Same Wall',
    body: (
      <p>
        For Same, the edges of the board count as <Stat value={10} />. A card placed against an edge
        with an A on that side has one match already.
      </p>
    ),
  },
  {
    option: 'plus',
    title: 'Plus',
    body: (
      <>
        <p>
          Add each side of your card to the touching side of its neighbour. If{' '}
          <strong>two or more</strong> of those sums are equal, your opponent&apos;s cards among
          them are captured.
        </p>
        <Example>
          Your card has <Stat value={4} /> on top and <Stat value={7} /> on the left. The card above
          has <Stat value={6} /> at its bottom (4 + 6 = 10) and the card to the left has{' '}
          <Stat value={3} /> on its right (7 + 3 = 10). Both sums are 10, so both are captured.
        </Example>
      </>
    ),
  },
  {
    option: 'combo',
    title: 'Combo',
    body: (
      <p>
        Cards captured by Same, Same Wall or Plus go on to capture their own neighbours with the
        basic rule, and those captures continue in a chain.
      </p>
    ),
  },
];

const ELEMENTAL_DEFAULT_LABELS = {
  off: 'Off by default',
  normal: 'Normal by default',
  all: 'All squares by default',
} as const;

async function RuleList() {
  const { roomPolicy } = await loadSettings();
  const defaults = roomPolicy.defaults.rules;
  const isLocked = (option: LockableOption) => roomPolicy.locked.includes(option);

  return (
    <dl className="space-y-4">
      {RULES.map((rule) => (
        <div key={rule.option}>
          <dt className="flex flex-wrap items-center gap-2 font-semibold text-cream">
            {rule.title}
            <PolicyBadge
              label={defaults[rule.option] ? 'On by default' : 'Off by default'}
              locked={isLocked(rule.option)}
            />
          </dt>
          <dd className="mt-1 space-y-2">{rule.body}</dd>
        </div>
      ))}
      <div id="elemental">
        <dt className="flex flex-wrap items-center gap-2 font-semibold text-cream">
          Elemental
          <PolicyBadge
            label={ELEMENTAL_DEFAULT_LABELS[defaults.elemental]}
            locked={isLocked('elemental')}
          />
        </dt>
        <dd className="mt-1 space-y-2">
          <p>
            Some squares get a random element for the whole game: none when Off, 0 to{' '}
            {MAX_NORMAL_ELEMENTAL_CELLS} squares with Normal, and every square with All squares.
          </p>
          <p>
            A card placed on an elemental square gets <strong>+1 on every side</strong> if its
            element matches, and <strong>−1 on every side</strong> if it does not (including cards
            with no element). This counts for the basic rule and Combo; Same and Plus use the
            printed numbers.
          </p>
        </dd>
      </div>
    </dl>
  );
}

function PolicyBadge({ label, locked }: { readonly label: string; readonly locked: boolean }) {
  return (
    <span className="rounded-sm bg-black/30 px-1.5 py-0.5 text-[10px] font-normal tracking-wider text-slate-300 uppercase">
      {locked ? `${label.replace(' by default', '')} on this server` : label}
    </span>
  );
}

function Section({
  id,
  title,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <Window
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-20 space-y-3 p-6 text-slate-200"
    >
      <h2 id={`${id}-title`} className="font-display text-xl font-bold tracking-wider text-cream">
        {title}
      </h2>
      {children}
    </Window>
  );
}

function Example({ children }: { readonly children: ReactNode }) {
  return (
    <p className="rounded border-l-2 border-frame/60 bg-black/20 px-3 py-2 text-sm text-slate-300">
      <span className="mr-1 font-semibold text-cream">Example:</span>
      {children}
    </p>
  );
}

function Stat({ value }: { readonly value: number }) {
  return <strong className="font-display text-cream">{formatStat(value)}</strong>;
}

function Loading() {
  return <p className="text-sm text-slate-400">Loading…</p>;
}
