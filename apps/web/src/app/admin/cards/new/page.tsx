import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CardForm } from '@/components/cards/card-form';
import { getDatabase } from '@/server/db';
import { getGameSettings } from '@/server/settings/settings';
import { requireAdmin } from '@/server/web/current-user';
import { saveGenericCardAction } from '../../actions';

export const metadata: Metadata = { title: 'New generic card' };

export default function NewGenericCardPage() {
  return (
    <>
      <h1 className="mb-6 font-display text-2xl font-bold tracking-wider text-cream">
        New generic card
      </h1>
      <Suspense fallback={<p className="text-slate-300">Loading…</p>}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  await requireAdmin();
  return (
    <CardForm
      scoring={getGameSettings(getDatabase()).scoring}
      action={saveGenericCardAction}
      cancelHref="/admin/cards"
    />
  );
}
