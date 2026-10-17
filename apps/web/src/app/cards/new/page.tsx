import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requireUser } from '@/server/web/current-user';
import { CardMaker } from './card-maker';

export const metadata: Metadata = { title: 'New card' };

export default function NewCardPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream">New card</h1>
      <p className="mt-1 mb-6 text-sm text-slate-300/80">
        Stronger stats cost more stars. Cards above five stars cannot be saved.
      </p>
      <Suspense fallback={<p className="text-slate-300">Loading…</p>}>
        <SignedInCardMaker />
      </Suspense>
    </main>
  );
}

async function SignedInCardMaker() {
  await requireUser();
  return <CardMaker />;
}
