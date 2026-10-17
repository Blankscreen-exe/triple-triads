import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Window } from '@/components/ui/window';
import { loadConfig } from '@/server/config';
import { getDatabase } from '@/server/db';
import { getEditableSettings } from '@/server/settings/settings';
import { requireAdmin } from '@/server/web/current-user';
import { DeckRulesForm, RoomPolicyForm, ScoringForm } from './settings-forms';

export const metadata: Metadata = { title: 'Settings' };

export default function AdminSettingsPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream">Settings</h1>
      <Suspense fallback={<p className="mt-4 text-slate-300">Loading…</p>}>
        <Forms />
      </Suspense>
    </>
  );
}

async function Forms() {
  await requireAdmin();
  const settings = getEditableSettings(getDatabase());
  const { dataDir } = loadConfig(process.env);
  return (
    <div className="mt-6 space-y-6">
      <ScoringForm initial={settings.scoring} />
      <DeckRulesForm initial={settings.deckRules} />
      <RoomPolicyForm initial={settings.roomPolicy} />
      <Window className="p-5" aria-label="Storage">
        <h2 className="font-display text-lg font-bold tracking-wider text-cream">Storage</h2>
        <p className="mt-1 text-sm text-slate-300/80">
          The database and uploads are stored in <code className="text-cream">{dataDir}</code>. Set
          with the <code>DATA_DIR</code> environment variable.
        </p>
      </Window>
    </div>
  );
}
