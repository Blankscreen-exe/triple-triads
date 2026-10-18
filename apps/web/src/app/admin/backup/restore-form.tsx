'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, buttonClasses } from '@/components/ui/button';
import type { RestoreResponse } from './restore/route';

type State =
  | { readonly kind: 'idle' }
  | { readonly kind: 'restoring' }
  | { readonly kind: 'done'; readonly result: RestoreResponse };

/** Uploads a backup file to replace the server's data, after an explicit confirmation. */
export function RestoreForm() {
  const [file, setFile] = useState<File | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [state, setState] = useState<State>({ kind: 'idle' });

  if (state.kind === 'done' && state.result.ok) {
    const { counts, createdAt } = state.result.manifest;
    return (
      <div role="status" className="space-y-3 rounded-md bg-status-open/30 px-4 py-3 text-sm">
        <p className="font-semibold text-cream">Backup restored.</p>
        <p>
          {counts.users} players, {counts.cards} cards, {counts.decks} decks, {counts.matches}{' '}
          matches and {counts.files} files from the backup made{' '}
          {new Date(createdAt).toLocaleString()}.
        </p>
        <p>Everyone has been logged out, including you.</p>
        <Link href="/login" className={buttonClasses('primary')}>
          Log in
        </Link>
      </div>
    );
  }

  const restore = async () => {
    if (!file) return;
    setState({ kind: 'restoring' });
    try {
      const response = await fetch('/admin/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body: file,
      });
      const result = (await response.json()) as RestoreResponse;
      setState({ kind: 'done', result });
    } catch {
      setState({
        kind: 'done',
        result: { ok: false, error: 'The upload failed. Check your connection and try again.' },
      });
    }
  };

  const restoring = state.kind === 'restoring';
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (window.confirm('Replace everything on this server with this backup?')) void restore();
      }}
    >
      <label className="block text-sm">
        <span className="block font-medium text-slate-100">Backup file</span>
        <input
          type="file"
          accept=".zip,application/zip"
          disabled={restoring}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setState({ kind: 'idle' });
          }}
          className="mt-1 block w-full text-sm text-slate-200 file:mr-3 file:rounded-md file:border file:border-frame/60 file:bg-black/25 file:px-3 file:py-1.5 file:text-slate-100"
        />
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={understood}
          disabled={restoring}
          onChange={(event) => {
            setUnderstood(event.target.checked);
          }}
          className="mt-0.5"
        />
        I understand that everything currently on this server will be replaced.
      </label>
      {state.kind === 'done' && !state.result.ok && (
        <p role="alert" className="rounded-md bg-status-live/30 px-3 py-2 text-sm">
          {state.result.error}
        </p>
      )}
      <Button type="submit" disabled={!file || !understood || restoring}>
        {restoring ? 'Restoring…' : 'Restore backup'}
      </Button>
    </form>
  );
}
