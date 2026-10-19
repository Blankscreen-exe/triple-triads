import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PackEditor } from '@/components/packs/pack-editor';
import { ActionButton } from '@/components/ui/action-button';
import { Pagination } from '@/components/ui/pagination';
import { Window } from '@/components/ui/window';
import type { PackPart } from '@/lib/asset-pack-spec';
import { pageFromQuery, pageHref, paginate } from '@/lib/pagination';
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

/** Players' card styles listed per page. */
const PAGE_SIZE = 10;

export default function AdminPacksPage({ searchParams }: PageProps<'/admin/packs'>) {
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
        <CustomPacks searchParams={searchParams} />
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

async function CustomPacks({ searchParams }: Pick<PageProps<'/admin/packs'>, 'searchParams'>) {
  await requireAdmin();
  const query = await searchParams;
  // Which parts a style replaces is only known once its files are read, so it pages here.
  const packs = paginate(listCustomPacks(getDatabase()), pageFromQuery(query), PAGE_SIZE);
  return (
    <Window className="mt-8 p-5" aria-label="Players' card styles">
      <h2 className="font-display text-lg font-bold tracking-wider text-cream">
        Players&apos; card styles
      </h2>
      {packs.total === 0 ? (
        <p className="mt-2 text-sm text-slate-300/80">No player has customised their style.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {packs.items.map((pack) => (
            <li key={pack.userId} className="flex items-center justify-between gap-3">
              <span className="min-w-0 break-words text-slate-100">
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
      <Pagination
        label="Players' card styles"
        className="mt-4"
        page={packs.page}
        pageCount={packs.pageCount}
        hrefFor={(page) => pageHref('/admin/packs', query, page)}
      />
    </Window>
  );
}
