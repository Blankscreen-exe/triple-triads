import type { Metadata } from 'next';
import { Window } from '@/components/ui/window';
import { buttonClasses } from '@/components/ui/button';
import { RestoreForm } from './restore-form';

export const metadata: Metadata = { title: 'Backup' };

/** The admin layout already restricts this page to admins. */
export default function BackupPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream">Backup</h1>
      <p className="mt-1 mb-6 text-sm text-slate-300/80">
        Save everything on this server to one file, or replace everything with a saved file, for
        example to move the server to another machine.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Window className="space-y-3 p-5" aria-label="Export">
          <h2 className="font-display text-lg font-bold tracking-wider text-cream">Export</h2>
          <p className="text-sm text-slate-200">
            Downloads a backup with every account, deck, card, match, setting and card style, and
            all uploaded images.
          </p>
          <p className="rounded-md bg-status-live/25 px-3 py-2 text-xs text-slate-100">
            The backup contains every player&apos;s password hash. Keep it private, as you would the
            server itself.
          </p>
          <a href="/admin/backup/download" download className={buttonClasses('primary')}>
            Download backup
          </a>
        </Window>

        <Window className="space-y-3 p-5" aria-label="Import">
          <h2 className="font-display text-lg font-bold tracking-wider text-cream">Import</h2>
          <p className="text-sm text-slate-200">
            Replaces <strong>everything</strong> on this server with a backup: accounts, decks,
            cards, matches, settings, card styles and images. Games in progress end, and everyone
            (including you) logs in again with the accounts from the backup.
          </p>
          <RestoreForm />
        </Window>
      </div>
    </>
  );
}
