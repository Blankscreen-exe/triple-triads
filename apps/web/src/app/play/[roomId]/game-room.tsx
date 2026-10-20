'use client';

import { opponentOf, type PlayerColor, type Position } from '@triple-triad/engine';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { CardView } from '@/components/cards/card-view';
import { CardPreview } from '@/components/game/card-preview';
import { Board } from '@/components/game/board';
import { DragGhost, useCardDrag } from '@/components/game/card-drag';
import { CaptureBanner } from '@/components/game/capture-banner';
import { Countdown } from '@/components/game/countdown';
import { Hand } from '@/components/game/hand';
import { PlayerPanel } from '@/components/game/player-panel';
import { ResultPanel } from '@/components/game/result-panel';
import { CoinFlip } from '@/components/game/coin-flip';
import { RoundAnnounce } from '@/components/game/round-announce';
import { RuleChips } from '@/components/game/rule-chips';
import { ScoreStrip } from '@/components/game/score-strip';
import { WhiteFlagIcon } from '@/components/game/white-flag-icon';
import { useGameStats } from '@/lib/use-game-stats';
import { Button, buttonClasses } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Modal, ModalClose } from '@/components/ui/modal';
import { Window } from '@/components/ui/window';
import { notify } from '@/lib/notifications';
import { useRoom } from '@/lib/realtime/hooks';
import { ROOM_ERRORS, type FirstPlayerReason, type RoomSnapshot } from '@/lib/realtime/protocol';

interface GameRoomProps {
  readonly roomId: string;
  readonly role: 'player' | 'spectator';
}

export function GameRoom({ roomId, role }: GameRoomProps) {
  const router = useRouter();
  const room = useRoom(roomId, role);
  const { snapshot, error, closed, closedReason } = room;

  // Out of the room, whether you left or it closed (e.g. the other player left): back to the
  // lobby, saying why if it was not your own doing. Replace, so Back does not return to it.
  useEffect(() => {
    if (!closed) return;
    if (closedReason) notify(closedReason);
    router.replace('/play');
  }, [closed, closedReason, router]);

  if (closed) {
    return <p className="py-12 text-center text-slate-300">Returning to the lobby…</p>;
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

  return (
    <div className="space-y-5">
      {/* On phones a game fills the screen, with these in its menu instead. */}
      <header
        className={`flex items-start justify-between gap-3 ${snapshot.game ? 'max-sm:hidden' : ''}`}
      >
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold tracking-wider text-cream sm:text-2xl">
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
          <LeaveButton snapshot={snapshot} room={room} />
        </div>
      </header>

      {error && (
        // Floats over the full-screen game on phones.
        <p
          role="alert"
          className="rounded-md bg-status-live/30 px-3 py-2 text-sm max-sm:fixed max-sm:inset-x-3 max-sm:top-24 max-sm:z-50 max-sm:bg-status-live/90"
        >
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
  const [previewId, setPreviewId] = useState<string | null>(null);
  const game = snapshot.game;
  // Spectators can close the match result; it shows again for the next match.
  const showResult = game?.view.result != null && game.match.nextRoundAt === null;
  const [resultClosed, setResultClosed] = useState(false);
  if (resultClosed && !showResult) setResultClosed(false);
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

  // Only a card still in your hand can be previewed from it.
  const previewCard = myHand.find((card) => card.instanceId === previewId);
  const previewFace = previewCard ? game.cards[previewCard.card.id] : undefined;

  const draggedCard = myHand.find((card) => card.instanceId === drag.drag?.instanceId);
  const draggedFace = draggedCard ? game.cards[draggedCard.card.id] : undefined;

  const place = (position: Position) => {
    if (!selection) return;
    room.move(selection, position);
    setSelectedId(null);
  };

  // Phones stack the table: the left side above the board in one row (panel, then hand), the
  // right side (yours) below it with the hand across the full width. Wider screens put the
  // sides next to the board.
  const side = (color: PlayerColor) => {
    const player = game.players[color];
    const isYou = color === you;
    const top = color === left;
    return (
      <aside
        className={`flex w-full gap-2 sm:block sm:w-[clamp(76px,16vw,140px)] sm:space-y-3 ${top ? 'items-center' : 'flex-col'}`}
        aria-label={`${player.username}'s side`}
      >
        <div className={top ? 'w-2/5 shrink-0 sm:w-auto' : ''}>
          <PlayerPanel
            username={player.username}
            color={color}
            score={view.score[color]}
            drawPileSize={view.players[color].drawPileSize}
            connected={player.connected}
            isYou={isYou}
            isActive={playing && view.activePlayer === color}
            slim={!top}
          />
        </div>
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
              onSelect: setSelectedId,
              onPreview: setPreviewId,
              drag,
            },
          })}
        />
      </aside>
    );
  };

  return (
    <>
      {/*
       * On phones the game fills the screen (over the site header) and never scrolls: the score
       * and a menu on top, then the turn, the opponent, the board (as large as the space left
       * allows) and your hand. Room details, the full scoreboard and leaving are behind buttons.
       */}
      <div className="space-y-5 max-sm:fixed max-sm:inset-0 max-sm:z-40 max-sm:flex max-sm:flex-col max-sm:gap-2 max-sm:space-y-0 max-sm:overscroll-none max-sm:bg-night max-sm:px-3 max-sm:pt-2 max-sm:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <ScoreStrip game={game} stats={gameStats}>
          <GameMenu snapshot={snapshot} room={room} />
        </ScoreStrip>
        <StatusLine
          snapshot={snapshot}
          clockOffset={room.clockOffset}
          myTurn={myTurn}
          hasSelection={!!selection}
        />
        <div className="flex flex-col items-center gap-3 max-sm:min-h-0 max-sm:flex-1 max-sm:gap-2 sm:flex-row sm:items-start sm:justify-center sm:gap-6">
          {side(left)}
          {/* On phones the board takes the height left over, measured with a size container. */}
          <div className="flex w-full min-h-0 flex-1 items-center justify-center [container-type:size] sm:contents">
            <div className="relative w-[min(100cqw,calc(100cqh*0.72))] sm:w-[clamp(240px,min(48vw,(100svh-320px)*0.72),460px)]">
              <Board
                game={game}
                canPlace={myTurn && selection !== null}
                onPlace={place}
                acceptsDrop={myTurn}
                drag={drag.drag}
              />
              <CaptureBanner game={game} />
            </div>
          </div>
          {side(right)}
        </div>
        {previewCard && previewFace && (
          <CardPreview
            card={previewFace}
            side={right}
            pack={game.players[right].pack}
            onClose={() => {
              setPreviewId(null);
            }}
            {...(myTurn && {
              action: {
                label: 'Use',
                onClick: () => {
                  setSelectedId(previewCard.instanceId);
                  setPreviewId(null);
                },
              },
            })}
          />
        )}
        <DragGhost controls={drag}>
          {draggedFace && (
            <CardView card={draggedFace} side={right} pack={game.players[right].pack} />
          )}
        </DragGhost>
        <CoinFlip
          winnerColor={game.firstPlayer.color}
          winnerName={game.players[game.firstPlayer.color].username}
          round={game.match.round}
          turn={view.turn}
          reason={game.firstPlayer.reason}
        />
        {game.match.format === 'until-winner' && (
          <RoundAnnounce round={game.match.round} turn={view.turn} />
        )}
        {view.result && game.match.nextRoundAt !== null && (
          // Phones show the short version in the status line.
          <div className="mx-auto max-w-sm max-sm:hidden">
            <RoundBreak snapshot={snapshot} clockOffset={room.clockOffset} />
          </div>
        )}
      </div>
      {showResult && !resultClosed && (
        <ResultPanel
          room={snapshot}
          onVote={room.vote}
          onLeave={() => void room.leave()}
          onDismiss={() => {
            setResultClosed(true);
          }}
          stats={gameStats}
        />
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
    const { match } = game;
    const { nextRoundAt, round } = match;
    if (nextRoundAt === null) return null;
    const roundWinner = game.view.result.winner;
    const roundLabel = roundWinner
      ? `${game.players[roundWinner].username} won round ${String(round)}`
      : `Round ${String(round)} was a draw`;
    return (
      <p className="text-center text-sm" role="status">
        {roundLabel} · Round {round + 1} in{' '}
        <Countdown deadline={nextRoundAt} clockOffset={clockOffset} />
        <span className="sm:hidden">
          {' '}
          · Cards left {match.cardsLeft.red}–{match.cardsLeft.blue}
        </span>
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
      {game.view.turn === 1 && (
        // The coin flip announces this on phones, where space is short.
        <p className="text-sm text-slate-300 max-sm:hidden">
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
            className="font-display text-xl text-cream sm:text-2xl"
          />
        )}
      </div>
    </div>
  );
}

/** Surrender during a match (asked about first, as it loses it); otherwise leave or stop watching. */
function LeaveButton({
  snapshot,
  room,
  className,
}: {
  readonly snapshot: RoomSnapshot;
  readonly room: ReturnType<typeof useRoom>;
  readonly className?: string;
}) {
  if (snapshot.you.role === 'player' && snapshot.game && snapshot.status === 'playing') {
    return (
      <Button
        variant="secondary"
        className={className}
        onClick={() => {
          if (window.confirm('Surrender? You lose this match and the room closes.')) {
            void room.leave();
          }
        }}
      >
        <WhiteFlagIcon />
        Surrender
      </Button>
    );
  }
  return (
    <Button variant="secondary" className={className} onClick={() => void room.leave()}>
      {snapshot.you.role === 'spectator' ? 'Stop watching' : 'Leave room'}
    </Button>
  );
}

/** Phones only: the room's details and leaving, in a sheet from the bottom of the screen. */
function GameMenu({
  snapshot,
  room,
}: {
  readonly snapshot: RoomSnapshot;
  readonly room: ReturnType<typeof useRoom>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Game menu"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
        }}
        className="flex size-8 items-center justify-center rounded-md text-cream hover:bg-white/10 sm:hidden"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open && (
        <Modal
          label="Game menu"
          variant="sheet"
          onClose={() => {
            setOpen(false);
          }}
        >
          <Window className="space-y-4 rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div>
              <h2 className="font-display text-xl font-bold tracking-wider text-cream">
                {snapshot.name}
              </h2>
              {snapshot.spectators > 0 && (
                <p className="text-xs text-slate-300/70">{snapshot.spectators} watching</p>
              )}
            </div>
            <RuleChips options={snapshot.options} />
            <div className="flex gap-3">
              <LeaveButton snapshot={snapshot} room={room} className="flex-1" />
              <ModalClose className="flex-1">Back to the game</ModalClose>
            </div>
          </Window>
        </Modal>
      )}
    </>
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
    case 'next-round':
      return `Players take turns to start: ${username} starts round ${String(round)}.`;
  }
}

/** Between the rounds of a match: the last round's score and when the next round starts. */
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
          ? `Round ${String(match.round)}: ${players[result.winner].username} wins`
          : `Round ${String(match.round)}: draw`}
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
