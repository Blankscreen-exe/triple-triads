import type { PlayerColor } from '@triple-triad/engine';
import type { GameStats, CapturesByType } from '@/lib/game-stats';
import type { MatchSnapshot } from '@/lib/realtime/protocol';
import { Window } from '../ui/window';

interface StatBoardProps {
  readonly stats: GameStats;
  readonly players: Readonly<Record<PlayerColor, string>>;
  readonly match: MatchSnapshot;
  readonly gameOver: boolean;
}

export function StatBoard({ stats, players, match, gameOver }: StatBoardProps) {
  const showMatchStats = match.format === 'until-winner';
  return (
    <Window className="w-full p-4 sm:p-5" aria-label="Match statistics">
      {showMatchStats && (
        <Scoreboard stats={stats} players={players} match={match} />
      )}

      {!showMatchStats && (
        <h3 className="mb-3 text-center font-display text-sm font-bold tracking-[0.15em] text-cream uppercase">
          Stats
        </h3>
      )}

      <div className="mb-4">
        <SectionLabel>Combat</SectionLabel>
        <ComparisonRow label="Cards captured" red={stats.red.cardsCaptured} blue={stats.blue.cardsCaptured} />
        <ComparisonRow label="Cards lost" red={stats.red.cardsLost} blue={stats.blue.cardsLost} invert />
        <ComparisonRow
          label="Capture efficiency"
          red={stats.red.captureEfficiency}
          blue={stats.blue.captureEfficiency}
          format={formatPercent}
        />
        <ComparisonRow label="Timeouts" red={stats.red.timeouts} blue={stats.blue.timeouts} invert />
        <ComparisonRow
          label="Avg rarity"
          red={stats.red.avgRarity}
          blue={stats.blue.avgRarity}
          format={formatOneDecimal}
        />
        <StrongestCardRow
          red={stats.red.strongestCard}
          blue={stats.blue.strongestCard}
          players={players}
        />
      </div>

      <div className={gameOver && stats.endGame ? 'mb-4' : ''}>
        <SectionLabel>Breakdown</SectionLabel>
        <CaptureTypeRow captures={stats.unified.capturesByType} />
        {stats.unified.longestComboChain && (
          <UnifiedRow
            label="Longest combo"
            value={`${String(stats.unified.longestComboChain.length)} wave${stats.unified.longestComboChain.length === 1 ? '' : 's'}`}
            detail={players[stats.unified.longestComboChain.player]}
          />
        )}
        {stats.unified.firstBlood && (
          <UnifiedRow label="First blood" value={players[stats.unified.firstBlood]} />
        )}
      </div>

      {gameOver && stats.endGame && (stats.endGame.sweep || stats.endGame.shutout) && (
        <div>
          <SectionLabel>Achievements</SectionLabel>
          {stats.endGame.sweep && (
            <Achievement label="Sweep" detail={`${players[stats.endGame.sweep]} controls all cells`} />
          )}
          {stats.endGame.shutout && (
            <Achievement label="Shutout" detail={`${players[stats.endGame.shutout]} lost no cards`} />
          )}
        </div>
      )}
    </Window>
  );
}

function Scoreboard({
  stats,
  players,
  match,
}: {
  readonly stats: GameStats;
  readonly players: Readonly<Record<PlayerColor, string>>;
  readonly match: MatchSnapshot;
}) {
  return (
    <div className="mb-5 border-b border-frame/20 pb-4">
      <h3 className="mb-4 text-center font-display text-xs font-bold tracking-[0.2em] text-slate-400 uppercase">
        Scoreboard
      </h3>

      <div className="flex items-center justify-between gap-2">
        <PlayerLabel color="red" username={players.red} align="right" />
        <span className="text-xs text-slate-400/60 uppercase">vs</span>
        <PlayerLabel color="blue" username={players.blue} align="left" />
      </div>

      <div className="mt-3 space-y-2">
        <ScoreRow
          label="Rounds won"
          red={match.seriesScore.red}
          blue={match.seriesScore.blue}
        />
        <ScoreRow
          label="Cards left"
          red={match.cardsLeft.red}
          blue={match.cardsLeft.blue}
        />
        <p className="text-center text-[10px] text-slate-400">
          Round {match.round} of 3
        </p>
      </div>
    </div>
  );
}

function PlayerLabel({
  color,
  username,
  align,
}: {
  readonly color: PlayerColor;
  readonly username: string;
  readonly align: 'left' | 'right';
}) {
  return (
    <span
      className={`font-display text-lg font-black tracking-wider sm:text-xl ${align === 'right' ? 'text-right' : 'text-left'} ${color === 'red' ? 'text-score-red' : 'text-score-blue'}`}
    >
      {username}
    </span>
  );
}

function ScoreRow({
  label,
  red,
  blue,
}: {
  readonly label: string;
  readonly red: number;
  readonly blue: number;
}) {
  const redLeads = red > blue;
  const blueLeads = blue > red;
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex-1 text-right font-display text-3xl font-black [text-shadow:0_2px_0_#000] sm:text-4xl ${redLeads ? 'text-score-red' : 'text-slate-300/60'}`}
      >
        {red}
      </span>
      <span className="w-28 text-center text-[10px] font-semibold tracking-[0.15em] text-slate-400 uppercase sm:text-xs">
        {label}
      </span>
      <span
        className={`flex-1 font-display text-3xl font-black [text-shadow:0_2px_0_#000] sm:text-4xl ${blueLeads ? 'text-score-blue' : 'text-slate-300/60'}`}
      >
        {blue}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { readonly children: string }) {
  return (
    <p className="mb-1.5 border-b border-frame/20 pb-1 text-[10px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
      {children}
    </p>
  );
}

function ComparisonRow({
  label,
  red,
  blue,
  format = formatNumber,
  invert = false,
}: {
  readonly label: string;
  readonly red: number | null;
  readonly blue: number | null;
  readonly format?: (v: number | null) => string;
  readonly invert?: boolean;
}) {
  const redWins = red !== null && blue !== null && (invert ? red < blue : red > blue);
  const blueWins = red !== null && blue !== null && (invert ? blue < red : blue > red);
  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      <span className={`w-8 text-right font-semibold ${redWins ? 'text-score-red' : 'text-slate-200'}`}>
        {format(red)}
      </span>
      <span className="flex-1 text-center text-slate-300/70">{label}</span>
      <span className={`w-8 text-left font-semibold ${blueWins ? 'text-score-blue' : 'text-slate-200'}`}>
        {format(blue)}
      </span>
    </div>
  );
}

function StrongestCardRow({
  red,
  blue,
  players,
}: {
  readonly red: { name: string; stars: number } | null;
  readonly blue: { name: string; stars: number } | null;
  readonly players: Readonly<Record<PlayerColor, string>>;
}) {
  if (!red && !blue) return null;
  const better =
    red && blue ? (red.stars > blue.stars ? 'red' : blue.stars > red.stars ? 'blue' : null) : null;
  return (
    <div className="py-1 text-xs">
      <p className="text-center text-slate-300/70">Strongest card</p>
      <div className="mt-0.5 flex items-center gap-2">
        <span className={`flex-1 text-right ${better === 'red' ? 'text-score-red' : 'text-slate-200'}`}>
          {red ? `${red.name} (${'★'.repeat(red.stars)})` : '—'}
        </span>
        <span className="text-slate-400/50">·</span>
        <span className={`flex-1 text-left ${better === 'blue' ? 'text-score-blue' : 'text-slate-200'}`}>
          {blue ? `${blue.name} (${'★'.repeat(blue.stars)})` : '—'}
        </span>
      </div>
    </div>
  );
}

const TYPE_LABELS: Record<keyof CapturesByType, string> = {
  basic: 'Basic',
  same: 'Same',
  plus: 'Plus',
  combo: 'Combo',
};

function CaptureTypeRow({ captures }: { readonly captures: CapturesByType }) {
  const total = captures.basic + captures.same + captures.plus + captures.combo;
  return (
    <div className="py-1 text-xs">
      <p className="text-center text-slate-300/70">Captures by type</p>
      <div className="mt-1 flex justify-center gap-3">
        {(Object.keys(TYPE_LABELS) as (keyof CapturesByType)[]).map((type) => (
          <span key={type} className="text-slate-200">
            <span className="text-slate-400">{TYPE_LABELS[type]}</span>{' '}
            <span className="font-semibold">{captures[type]}</span>
            {total > 0 && (
              <span className="text-slate-400/60 ml-0.5 text-[9px]">
                ({Math.round((captures[type] / total) * 100)}%)
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function UnifiedRow({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 py-1 text-xs">
      <span className="text-slate-300/70">{label}:</span>
      <span className="font-semibold text-cream">{value}</span>
      {detail && <span className="text-slate-400">({detail})</span>}
    </div>
  );
}

function Achievement({ label, detail }: { readonly label: string; readonly detail: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1 text-xs">
      <span className="font-display font-bold tracking-wider text-gold">{label}</span>
      <span className="text-slate-300/80">{detail}</span>
    </div>
  );
}

function formatNumber(v: number | null): string {
  return v === null ? '—' : String(v);
}

function formatPercent(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`;
}

function formatOneDecimal(v: number | null): string {
  return v === null ? '—' : v.toFixed(1);
}
