'use client';

import { opponentOf, type PlayerColor, type Position } from '@triple-triad/engine';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { CardView } from '@/components/cards/card-view';
import { Board } from '@/components/game/board';
import { DragGhost, useCardDrag } from '@/components/game/card-drag';
import { CaptureBanner } from '@/components/game/capture-banner';
import { Countdown } from '@/components/game/countdown';
import { Hand } from '@/components/game/hand';
import { PlayerPanel } from '@/components/game/player-panel';
import { ResultPanel } from '@/components/game/result-panel';
import { RoundAnnounce } from '@/components/game/round-announce';
import { RuleChips } from '@/components/game/rule-chips';
import { StatBoard } from '@/components/game/stat-board';
import { useGameStats } from '@/lib/use-game-stats';
import { Button, buttonClasses } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Window } from '@/components/ui/window';
import { useRoom } from '@/lib/realtime/hooks';
import { ROOM_ERRORS, type FirstPlayerReason, type RoomSnapshot } from '@/lib/realtime/protocol';

interface GameRoomProps {
  readonly roomId: string;
  readonly role: 'player' | 'spectator';
}

export function GameRoom({ roomId, role }: GameRoomProps) {
  const router = useRouter();
  const room = useRoom(roomId, role);
  const { snapshot, error, closed } = room;

  if (closed) {
    return (
      <Notice title="You left the room">
        <Link href="/play" className={buttonClasses('primary')}>
          Back to the lobby
        </Link>
      </Notice>
    );
  }

  if (!snapshot) {
    if (error === 'WRONG_PASSWORD') {
      return <PasswordPrompt onSubmit={(pw) => room.join(pw, role)} />;
    }
    if (error) {
      return (
        <Notice title={ROOM_ERRORS[error]}>
          {error === 'ROOM_FULL' && (
            <Button variant="secondary" onClick={() => void room.join('', 'spectator')}>
              Watch instead
            </Button>
          )}
          <Link href="/play" className={buttonClasses('primary')}>
            Back to the lobby
          </Link>
        </Notice>
      );
    }
    return <p className="py-12 text-center text-slate-300">Joining the room…</p>;
  }

  const leave = async () => {
    await room.leave();
    router.push('/play');
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-cream">
            {snapshot.name}
          </h1>
          <div className="mt-1.5">
            <RuleChips options={snapshot.options} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {snapshot.spectators > 0 && (
            <span className="text-xs text-slate-300/70">{snapshot.spectators} watching</span>
          )}
          <Button variant="secondary" onClick={() => void leave()}>
            {snapshot.you.role === 'spectator' ? 'Stop watching' : 'Leave room'}
          </Button>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-md bg-status-live/30 px-3 py-2 text-sm">
          {ROOM_ERRORS[error]}
        </p>
      )}

      {snapshot.game ? (
        <Table snapshot={snapshot} room={room} />
      ) : (
        <Notice title="Waiting for an opponent…">
          <p className="text-sm text-slate-300/80">
            Share this page&apos;s address, or wait for someone to join from the lobby.
          </p>
        </Notice>
      )}
    </div>
  );
}

function Table({
  snapshot,
  room,
}: {
  readonly snapshot: RoomSnapshot;
  readonly room: ReturnType<typeof useRoom>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const game = snapshot.game;
  const gameStats = useGameStats(game);
  const you = snapshot.you.color;
  const playing = snapshot.status === 'playing' && game !== null && !game.paused;
  const myTurn = playing && you !== null && game.view.activePlayer === you;
  const drag = useCardDrag({
    enabled: myTurn,
    onDrop: (instanceId, position) => {
      room.move(instanceId, position);
      setSelectedId(null);
    },
  });
  if (!game) return null;

  const { view } = game;
  // The viewer's side sits on the right (as in FF8); spectators see red left, blue right.
  const right: PlayerColor = you ?? 'blue';
  const left = opponentOf(right);
  const myHand = you ? (view.players[you].hand.cards ?? []) : [];
  // Selection is only valid while it is still in hand and still your turn.
  const selection =
    myTurn && myHand.some((card) => card.instanceId === selectedId) ? selectedId : null;

  const draggedCard = myHand.find((card) => card.instanceId === drag.drag?.instanceId);
  const draggedFace = draggedCard ? game.cards[draggedCard.card.id] : undefined;

  const place = (position: Position) => {
    if (!selection) return;
    room.move(selection, position);
    setSelectedId(null);
  };

  const side = (color: PlayerColor) => {
    const player = game.players[color];
    const isYou = color === you;
    return (
      <aside
        className="w-[clamp(76px,16vw,140px)] space-y-3"
        aria-label={`${player.username}'s side`}
      >
        <PlayerPanel
          username={player.username}
          color={color}
          score={view.score[color]}
          drawPileSize={view.players[color].drawPileSize}
          connected={player.connected}
          isYou={isYou}
          isActive={playing && view.activePlayer === color}
        />
        <Hand
          label={isYou ? 'Your hand' : `${player.username}'s hand`}
          hand={view.players[color].hand}
          color={color}
          pack={player.pack}
          cards={game.cards}
          {...(isYou && {
            selection: {
              selectedId: selection,
              enabled: myTurn,
              onSelect: (id: string) => {
                setSelectedId((current) => (current === id ? null : id));
              },
              drag,
            },
          })}
        />
      </aside>
    );
  };

  return (
    <>
      <div className="space-y-5">
        <StatusLine
          snapshot={snapshot}
          clockOffset={room.clockOffset}
          myTurn={myTurn}
          hasSelection={!!selection}
        />
        <div className="flex items-start justify-center gap-3 sm:gap-6">
          {side(left)}
          <div className="relative w-[clamp(240px,48vw,460px)]">
            <Board
              game={game}
              canPlace={myTurn && selection !== null}
              onPlace={place}
              acceptsDrop={myTurn}
              drag={drag.drag}
            />
            <CaptureBanner game={game} />
          </div>
          {side(right)}
        </div>
        <DragGhost controls={drag}>
          {draggedFace && (
            <CardView card={draggedFace} side={right} pack={game.players[right].pack} />
          )}
        </DragGhost>
        {game.match.format === 'until-winner' && (
          <RoundAnnounce round={game.match.round} turn={view.turn} />
        )}
        {view.result && game.match.nextRoundAt !== null && (
          <div className="mx-auto max-w-sm">
            <RoundBreak snapshot={snapshot} clockOffset={room.clockOffset} />
          </div>
        )}
        {gameStats && (
          <div className="mx-auto max-w-md">
            <StatBoard
              stats={gameStats}
              players={{
                red: game.players.red.username,
                blue: game.players.blue.username,
              }}
              match={game.match}
              gameOver={view.result !== null}
            />
          </div>
        )}
      </div>
      {view.result && game.match.nextRoundAt === null && (
        <ResultPanel room={snapshot} onVote={room.vote} />
      )}
    </>
  );
}

function StatusLine({
  snapshot,
  clockOffset,
  myTurn,
  hasSelection,
}: {
  readonly snapshot: RoomSnapshot;
  readonly clockOffset: number;
  readonly myTurn: boolean;
  readonly hasSelection: boolean;
}) {
  const game = snapshot.game;
  if (!game) return null;
  if (game.view.result) {
    // Between rounds: say so at the top too, as the details below the board may be off-screen.
    const { nextRoundAt, round } = game.match;
    if (nextRoundAt === null) return null;
    const roundWinner = game.view.result.winner;
    const roundLabel = roundWinner
      ? `${game.players[roundWinner].username} won round ${round}`
      : `Round ${round} was a draw`;
    return (
      <p className="text-center text-sm" role="status">
        {roundLabel} · Round {round + 1} in{' '}
        <Countdown deadline={nextRoundAt} clockOffset={clockOffset} />
      </p>
    );
  }

  if (game.paused) {
    return (
      <p className="text-center text-sm" role="status">
        <span className="font-semibold">{game.paused.username}</span> disconnected. The game is
        paused; they forfeit in{' '}
        <Countdown deadline={game.paused.forfeitAt} clockOffset={clockOffset} />.
      </p>
    );
  }

  const active = game.players[game.view.activePlayer].username;
  return (
    <div className="space-y-1.5 text-center" role="status">
      {game.match.format === 'until-winner' && (
        <p className="font-display text-xs tracking-[0.2em] text-slate-400 uppercase">
          Round {game.match.round} of 3
          {(game.match.seriesScore.red > 0 || game.match.seriesScore.blue > 0) &&
            ` · ${game.match.seriesScore.red}–${game.match.seriesScore.blue}`}
        </p>
      )}
      {game.view.turn === 1 && (
        <p className="text-sm text-slate-300">
          {firstPlayerMessage(
            game.players[game.firstPlayer.color].username,
            game.firstPlayer.reason,
            game.match.round,
          )}
        </p>
      )}
      <div className="flex items-center justify-center gap-3">
        <span
          className={`rounded-sm px-3 py-1 text-sm font-semibold ring-1 ring-white/60 ${myTurn ? 'bg-action' : 'bg-black/30'}`}
        >
          {myTurn
            ? hasSelection
              ? 'Choose a square'
              : 'Your turn: choose a card'
            : `${active}'s turn`}
        </span>
        {game.turnDeadline !== null && (
          <Countdown
            deadline={game.turnDeadline}
            clockOffset={clockOffset}
            className="font-display text-2xl text-cream"
          />
        )}
      </div>
    </div>
  );
}

function firstPlayerMessage(username: string, reason: FirstPlayerReason, round: number): string {
  switch (reason) {
    case 'coin-flip':
      return `Coin flip: ${username} goes first.`;
    case 'lost-last-game':
      return `${username} lost the last game, so goes first.`;
    case 'last-game-drawn':
      return `The last game was a draw, so ${username} goes first again.`;
    case 'round-drawn':
      return `The last round was a draw, so ${username} starts round ${String(round)}.`;
  }
}

/** Between the rounds of a match: the drawn round's score and when the next round starts. */
function RoundBreak({
  snapshot,
  clockOffset,
}: {
  readonly snapshot: RoomSnapshot;
  readonly clockOffset: number;
}) {
  const game = snapshot.game;
  const result = game?.view.result;
  const nextRoundAt = game?.match.nextRoundAt ?? null;
  if (!game || !result || nextRoundAt === null) return null;
  const { match, players } = game;
  // The player who did not start this round starts the next one.
  const nextStarter = players[opponentOf(game.firstPlayer.color)].username;

  return (
    <Window className="space-y-2 p-5 text-center" aria-live="polite">
      <h2 className="font-display text-2xl font-black tracking-widest text-cream [text-shadow:0_3px_0_#000]">
        {result.winner
          ? `Round ${match.round}: ${players[result.winner].username} wins`
          : `Round ${match.round}: draw`}
      </h2>
      <p className="text-sm text-slate-300/80">
        Red {result.score.red} – {result.score.blue} Blue
        {' · '}Series {match.seriesScore.red}–{match.seriesScore.blue}
      </p>
      <p className="text-sm text-slate-100">
        Round {match.round + 1} starts in{' '}
        <Countdown deadline={nextRoundAt} clockOffset={clockOffset} />. {nextStarter} goes first.
      </p>
      <p className="text-xs text-slate-300/80">
        Cards placed are used up. Cards left: {players.red.username} {match.cardsLeft.red} ·{' '}
        {players.blue.username} {match.cardsLeft.blue}
      </p>
    </Window>
  );
}

function Notice({ title, children }: { readonly title: string; readonly children?: ReactNode }) {
  return (
    <Window className="mx-auto max-w-md space-y-4 p-6 text-center">
      <h2 className="font-display text-xl font-bold tracking-wider text-cream">{title}</h2>
      <div className="flex flex-wrap justify-center gap-3">{children}</div>
    </Window>
  );
}

function PasswordPrompt({
  onSubmit,
}: {
  readonly onSubmit: (password: string) => Promise<boolean>;
}) {
  const [password, setPassword] = useState('');
  return (
    <Window className="mx-auto max-w-sm p-6">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(password);
        }}
      >
        <h2 className="font-display text-xl font-bold tracking-wider text-cream">Room password</h2>
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          autoFocus
        />
        <Button type="submit" className="w-full">
          Enter
        </Button>
      </form>
    </Window>
  );
}
