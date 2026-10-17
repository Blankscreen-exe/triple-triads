import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { requireAdmin } from '@/server/web/current-user';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin' } };

const SECTIONS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/cards', label: 'Generic cards' },
  { href: '/admin/starter-decks', label: 'Starter decks' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/moderation', label: 'Moderation' },
] as const;

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<p className="text-slate-300">Loading…</p>}>
        <AdminShell>{children}</AdminShell>
      </Suspense>
    </main>
  );
}

/** Nothing of the admin area, not even its navigation, is shown to non-admins. */
async function AdminShell({ children }: { readonly children: ReactNode }) {
  await requireAdmin();
  return (
    <>
      <nav aria-label="Admin" className="mb-6 flex flex-wrap gap-1 border-b border-frame/30 pb-3">
        {SECTIONS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="rounded px-3 py-1.5 text-sm text-slate-200/80 hover:bg-white/10 hover:text-white"
          >
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
