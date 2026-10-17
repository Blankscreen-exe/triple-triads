import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PackEditor } from '@/components/packs/pack-editor';
import type { PackPart } from '@/lib/asset-pack-spec';
import { getDatabase } from '@/server/db';
import { getAssetPack, getPackFiles } from '@/server/packs/asset-packs';
import { requireUser } from '@/server/web/current-user';
import { resetMyPackPart, uploadMyPackPart } from './actions';

export const metadata: Metadata = { title: 'Card style' };

export default function PacksPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream">Card style</h1>
      <p className="mt-1 mb-6 text-sm text-slate-300/80">
        Replace any part of the default card design. Your cards are shown in your style to everyone,
        including your opponents.
      </p>
      <Suspense fallback={<p className="text-slate-300">Loading…</p>}>
        <Editor />
      </Suspense>
    </main>
  );
}

async function Editor() {
  const user = await requireUser();
  const db = getDatabase();
  return (
    <PackEditor
      pack={getAssetPack(db, user.id)}
      replaced={Object.keys(getPackFiles(db, user.id)) as PackPart[]}
      upload={uploadMyPackPart}
      reset={resetMyPackPart}
    />
  );
}
