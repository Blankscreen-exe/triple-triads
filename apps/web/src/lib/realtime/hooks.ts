'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Ack,
  CreateRoomInput,
  RoomError,
  RoomSnapshot,
  RoomSummary,
  VoteChoice,
} from './protocol';
import { getSocket } from './socket-client';

/** Live list of open rooms. `null` until the first update arrives. */
export function useLobby(): readonly RoomSummary[] | null {
  const [rooms, setRooms] = useState<readonly RoomSummary[] | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const subscribe = () => socket.emit('lobby:subscribe');
    socket.on('lobby:rooms', setRooms);
    socket.on('connect', subscribe);
    subscribe();
    return () => {
      socket.off('lobby:rooms', setRooms);
      socket.off('connect', subscribe);
      socket.emit('lobby:unsubscribe');
    };
  }, []);

  return rooms;
}

export async function createRoom(input: CreateRoomInput): Promise<Ack<{ roomId: string }>> {
  return getSocket().emitWithAck('room:create', input);
}

export async function joinRoom(
  roomId: string,
  password: string,
  as: 'player' | 'spectator',
): Promise<Ack> {
  return getSocket().emitWithAck('room:join', { roomId, password, as });
}

export interface RoomConnection {
  readonly snapshot: RoomSnapshot | null;
  /** The most recent error from joining or from an action. */
  readonly error: RoomError | null;
  /** You are no longer in the room (you left, or it closed). */
  readonly closed: boolean;
  /** Server time minus local time, to show accurate countdowns. */
  readonly clockOffset: number;
  readonly join: (password: string, as: 'player' | 'spectator') => Promise<boolean>;
  readonly move: (instanceId: string, position: number) => void;
  readonly vote: (choice: VoteChoice) => void;
  readonly leave: () => Promise<void>;
}

/** Joins a room and keeps its snapshot up to date, re-joining after a reconnect. */
export function useRoom(roomId: string, initialRole: 'player' | 'spectator'): RoomConnection {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<RoomError | null>(null);
  const [closed, setClosed] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  // How we last joined, reused when re-joining after a reconnect.
  const membership = useRef({ password: '', as: initialRole });

  const join = useCallback(
    async (password: string, as: 'player' | 'spectator') => {
      const result = await joinRoom(roomId, password, as);
      setError(result.ok ? null : result.error);
      if (result.ok) membership.current = { password, as };
      return result.ok;
    },
    [roomId],
  );

  useEffect(() => {
    const socket = getSocket();
    const onState = (next: RoomSnapshot) => {
      if (next.id !== roomId) return;
      setClockOffset(next.serverTime - Date.now());
      setSnapshot(next);
    };
    const onClosed = ({ roomId: closedId }: { roomId: string }) => {
      if (closedId === roomId) setClosed(true);
    };
    // Re-join after every (re)connection; a seated player is simply reattached.
    const rejoin = () => {
      void join(membership.current.password, membership.current.as);
    };

    socket.on('room:state', onState);
    socket.on('room:closed', onClosed);
    socket.on('connect', rejoin);
    rejoin();
    return () => {
      socket.off('room:state', onState);
      socket.off('room:closed', onClosed);
      socket.off('connect', rejoin);
    };
  }, [roomId, join]);

  const report = useCallback((result: Ack) => {
    setError(result.ok ? null : result.error);
  }, []);

  const move = useCallback(
    (instanceId: string, position: number) => {
      void getSocket().emitWithAck('game:move', { roomId, instanceId, position }).then(report);
    },
    [roomId, report],
  );

  const vote = useCallback(
    (choice: VoteChoice) => {
      void getSocket().emitWithAck('game:vote', { roomId, choice }).then(report);
    },
    [roomId, report],
  );

  const leave = useCallback(async () => {
    await getSocket().emitWithAck('room:leave', { roomId });
    setClosed(true);
  }, [roomId]);

  return { snapshot, error, closed, clockOffset, join, move, vote, leave };
}

/** The current time, refreshed every `intervalMs` while `active`. */
export function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      clearInterval(timer);
    };
  }, [active, intervalMs]);
  return now;
}
