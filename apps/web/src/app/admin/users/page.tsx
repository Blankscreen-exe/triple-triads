import type { Metadata } from 'next';
import Form from 'next/form';
import { Suspense } from 'react';
import { ActionButton } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Window } from '@/components/ui/window';
import { pageFromQuery, pageHref } from '@/lib/pagination';
import { tierFor } from '@/lib/rating';
import { listUsers } from '@/server/admin/users';
import { getDatabase } from '@/server/db';
import { requireAdmin } from '@/server/web/current-user';
import { userAction } from '../actions';

export const metadata: Metadata = { title: 'Users' };

const PAGE_SIZE = 25;

export default function AdminUsersPage({ searchParams }: PageProps<'/admin/users'>) {
  return (
    <>
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream">Users</h1>
      <Suspense fallback={<p className="mt-4 text-slate-300">Loading…</p>}>
        <UserTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function UserTable({ searchParams }: Pick<PageProps<'/admin/users'>, 'searchParams'>) {
  const admin = await requireAdmin();
  const query = await searchParams;
  const { q } = query;
  const search = typeof q === 'string' ? q : '';
  const rows = listUsers(
    getDatabase(),
    { page: pageFromQuery(query), pageSize: PAGE_SIZE },
    search,
  );

  return (
    <Window className="mt-6 space-y-4 p-5 max-sm:px-3">
      {/* A plain GET form: the search is in the URL, and a new search starts on page 1. */}
      <Form action="/admin/users" role="search" aria-label="Find users" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={search}
          aria-label="Username"
          placeholder="Username"
          className="min-w-0 flex-1 rounded-md border border-frame/50 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-cream focus:outline-none"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </Form>
      <p className="text-sm text-slate-300/80">
        {search === ''
          ? `${String(rows.total)} ${rows.total === 1 ? 'account' : 'accounts'}`
          : `${String(rows.total)} ${rows.total === 1 ? 'account matches' : 'accounts match'} “${search}”`}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs tracking-wider text-slate-300/80 uppercase">
            <th className="py-2 pr-3">Player</th>
            <th className="py-2 pr-3 max-md:hidden">Role</th>
            <th className="py-2 pr-3 max-md:hidden">Rank</th>
            <th className="py-2 pr-3 text-right max-md:hidden">Games</th>
            <th className="py-2 pr-3 max-md:hidden">Joined</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.items.map((user) => {
            const isSelf = user.id === admin.id;
            return (
              <tr
                key={user.id}
                className="border-t border-frame/20 align-top"
                aria-label={user.username}
              >
                <td className="py-2 pr-3 max-md:w-1/3 max-md:max-w-0">
                  <div className="font-semibold break-words text-slate-100">
                    {user.username}
                    {user.bannedAt && (
                      <span className="ml-2 rounded-sm bg-status-live px-1.5 py-0.5 text-[10px] uppercase">
                        Banned
                      </span>
                    )}
                  </div>
                  {/* Narrow screens: the other columns, as a line under the name. */}
                  <div className="text-xs text-slate-300/80 md:hidden">
                    <span className="capitalize">{user.role}</span> · {tierFor(user.rating).label} ·{' '}
                    {user.gamesPlayed} {user.gamesPlayed === 1 ? 'game' : 'games'}
                  </div>
                </td>
                <td className="py-2 pr-3 capitalize max-md:hidden">{user.role}</td>
                <td className="py-2 pr-3 max-md:hidden">
                  {tierFor(user.rating).label} · {user.rating}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums max-md:hidden">
                  {user.gamesPlayed}
                </td>
                <td className="py-2 pr-3 max-md:hidden">
                  {user.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="py-2">
                  {isSelf ? (
                    <span className="text-xs text-slate-300/70">This is you</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {user.role === 'admin' ? (
                        <ActionButton action={userAction.bind(null, user.id, 'demote')}>
                          Demote
                        </ActionButton>
                      ) : (
                        <ActionButton action={userAction.bind(null, user.id, 'promote')}>
                          Make admin
                        </ActionButton>
                      )}
                      {user.bannedAt ? (
                        <ActionButton action={userAction.bind(null, user.id, 'unban')}>
                          Unban
                        </ActionButton>
                      ) : (
                        <ActionButton
                          action={userAction.bind(null, user.id, 'ban')}
                          confirmation={`Ban ${user.username}? They will be logged out.`}
                        >
                          Ban
                        </ActionButton>
                      )}
                      <ActionButton
                        action={userAction.bind(null, user.id, 'reset-password')}
                        confirmation={`Reset ${user.username}'s password? They will be logged out.`}
                      >
                        Reset password
                      </ActionButton>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination
        label="Users"
        page={rows.page}
        pageCount={rows.pageCount}
        hrefFor={(page) => pageHref('/admin/users', query, page)}
      />
    </Window>
  );
}
