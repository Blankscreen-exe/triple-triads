import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PackEditor } from '@/components/packs/pack-editor';
import { ActionButton } from '@/components/ui/action-button';
import { Window } from '@/components/ui/window';
import type { PackPart } from '@/lib/asset-pack-spec';
import { getDatabase } from '@/server/db';
import {
  DEFAULT_PACK_OWNER,
  getAssetPack,
  getPackFiles,
  listCustomPacks,
} from '@/server/packs/asset-packs';
import { requireAdmin } from '@/server/web/current-user';
import { resetDefaultPackPart, resetPlayerPackAction, uploadDefaultPackPart } from '../actions';

export const metadata: Metadata = { title: 'Card style' };

export default function AdminPacksPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream">
        Default card style
      </h1>
      <p className="mt-1 mb-6 text-sm text-slate-300/80">
        Changes here apply to every player who has not replaced that part of their own style.
      </p>
      <Suspense fallback={<p className="text-slate-300">Loading…</p>}>
        <DefaultPack />
        <CustomPacks />
      </Suspense>
    </>
  );
}

async function DefaultPack() {
  await requireAdmin();
  const db = getDatabase();
  return (
    <PackEditor
      pack={getAssetPack(db, DEFAULT_PACK_OWNER)}
      replaced={Object.keys(getPackFiles(db, DEFAULT_PACK_OWNER)) as PackPart[]}
      upload={uploadDefaultPackPart}
      reset={resetDefaultPackPart}
    />
  );
}

async function CustomPacks() {
  await requireAdmin();
  const packs = listCustomPacks(getDatabase());
  return (
    <Window className="mt-8 p-5" aria-label="Players' card styles">
      <h2 className="font-display text-lg font-bold tracking-wider text-cream">
        Players&apos; card styles
      </h2>
      {packs.length === 0 ? (
        <p className="mt-2 text-sm text-slate-300/80">No player has customised their style.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {packs.map((pack) => (
            <li key={pack.userId} className="flex items-center justify-between gap-3">
              <span className="text-slate-100">
                {pack.username}{' '}
                <span className="text-xs text-slate-300/70">
                  ({pack.parts} {pack.parts === 1 ? 'part' : 'parts'} replaced)
                </span>
              </span>
              <ActionButton
                variant="quiet"
                action={resetPlayerPackAction.bind(null, pack.userId)}
                confirmation={`Remove everything ${pack.username} uploaded to their card style?`}
              >
                Reset to default
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
    </Window>
  );
}
