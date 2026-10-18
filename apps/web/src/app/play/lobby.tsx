'use client';

import { opponentOf } from '@triple-triad/engine';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RuleChips } from '@/components/game/rule-chips';
import { Button } from '@/components/ui/button';
import { Window } from '@/components/ui/window';
import { joinRoom, useLobby } from '@/lib/realtime/hooks';
import { ROOM_ERRORS, type RoomError, type RoomSummary } from '@/lib/realtime/protocol';
import {
  applyRoomFilters,
  hasOpenSeat,
  roomFiltersFromSearchParams,
  roomFiltersToSearchParams,
} from '@/lib/room-filters';
import { useSearchParamState } from '@/lib/use-search-param-state';
import type { RoomPolicy } from '@/lib/validation/settings';
import { CreateRoomForm } from './create-room-form';
import { RoomFilterBar } from './room-filter-bar';

export function Lobby({
  username,
  policy,
}: {
  readonly username: string;
  readonly policy: RoomPolicy;
}) {
  const rooms = useLobby();
  const [filters, setFilters] = useSearchParamState(
    roomFiltersFromSearchParams,
    roomFiltersToSearchParams,
  );
  const visible = rooms === null ? [] : applyRoomFilters(rooms, filters);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Window className="space-y-4 p-5" aria-label="Rooms">
        <h2 className="font-display text-lg font-bold tracking-wider text-cream">Rooms</h2>
        <RoomFilterBar
          filters={filters}
          onChange={setFilters}
          shown={visible.length}
          total={rooms?.length ?? 0}
        />
        {rooms === null ? (
          <p className="text-sm text-slate-300/80">Connecting…</p>
        ) : rooms.length === 0 ? (
          <p className="text-sm text-slate-300/80">No rooms yet. Create one and invite a friend.</p>
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-300">No rooms match these filters.</p>
        ) : (
          <ul
            className="max-h-[min(40rem,65vh)] space-y-2 overflow-y-auto overscroll-contain pr-1"
            aria-label="Open rooms"
          >
            {visible.map((room) => (
              <RoomRow key={room.id} room={room} />
            ))}
          </ul>
        )}
      </Window>
      <Window className="p-5">
        <h2 className="mb-4 font-display text-lg font-bold tracking-wider text-cream">
          Create room
        </h2>
        <CreateRoomForm defaultName={`${username}'s room`} policy={policy} />
      </Window>
    </div>
  );
}

function RoomRow({ room }: { readonly room: RoomSummary }) {
  const router = useRouter();
  const [joining, setJoining] = useState<'player' | 'spectator' | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<RoomError | null>(null);
  const canPlay = hasOpenSeat(room);

  const join = async (as: 'player' | 'spectator') => {
    const result = await joinRoom(room.id, password, as);
    if (result.ok) {
      router.push(as === 'spectator' ? `/play/${room.id}?as=spectator` : `/play/${room.id}`);
    } else {
      setError(result.error);
    }
  };

  const start = (as: 'player' | 'spectator') => {
    if (room.hasPassword) setJoining(as);
    else void join(as);
  };

  return (
    <li
      aria-label={room.name}
      className="rounded-md border border-frame/30 bg-black/20 px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-100">
            {room.hasPassword && <span aria-label="Password protected">🔒 </span>}
            {room.name}
          </div>
          <div className="text-xs text-slate-300/70">
            {room.players.join(' vs ')}
            {canPlay && (
              <>
                {' · you play '}
                <span
                  className={
                    opponentOf(room.hostColor) === 'red' ? 'text-score-red' : 'text-score-blue'
                  }
                >
                  {opponentOf(room.hostColor)}
                </span>
              </>
            )}
            {room.spectators > 0 && ` · ${String(room.spectators)} watching`}
          </div>
        </div>
        <RuleChips options={room.options} />
        <div className="flex items-center gap-2">
          <span
            className={`rounded-sm px-2 py-0.5 text-xs ${room.status === 'waiting' ? 'bg-status-open/80' : 'bg-status-live/70'}`}
          >
            {room.status === 'waiting' ? 'Waiting' : 'In game'}
          </span>
          {canPlay && (
            <Button
              className="!px-3 !py-1 text-sm"
              onClick={() => {
                start('player');
              }}
            >
              Join
            </Button>
          )}
          {room.options.allowSpectators && (
            <Button
              variant="secondary"
              className="!px-3 !py-1 text-sm"
              onClick={() => {
                start('spectator');
              }}
            >
              Watch
            </Button>
          )}
        </div>
      </div>

      {joining && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void join(joining);
          }}
        >
          <input
            type="password"
            aria-label={`Password for ${room.name}`}
            placeholder="Room password"
            value={password}
            autoFocus
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            className="min-w-0 flex-1 rounded-md border border-frame/50 bg-black/30 px-3 py-1.5 text-sm"
          />
          <Button type="submit" className="!px-3 !py-1 text-sm">
            {joining === 'player' ? 'Join' : 'Watch'}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-status-live">
          {ROOM_ERRORS[error]}
        </p>
      )}
    </li>
  );
}
