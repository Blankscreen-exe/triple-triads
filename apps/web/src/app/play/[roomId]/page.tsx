import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireUser } from '@/server/web/current-user';
import { GameRoom } from './game-room';

export const metadata: Metadata = { title: 'Game' };

export default function RoomPage({ params, searchParams }: PageProps<'/play/[roomId]'>) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Suspense fallback={<p className="py-12 text-center text-slate-300">Loading…</p>}>
        <RoomLoader params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function RoomLoader({ params, searchParams }: PageProps<'/play/[roomId]'>) {
  await requireUser();
  const { roomId } = await params;
  const { as } = await searchParams;
  return <GameRoom roomId={roomId} role={as === 'spectator' ? 'spectator' : 'player'} />;
}
