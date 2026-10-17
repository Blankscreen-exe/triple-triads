import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ActionButton } from '@/components/ui/action-button';
import { Window } from '@/components/ui/window';
import { tierFor } from '@/lib/rating';
import { listUsers } from '@/server/admin/users';
import { getDatabase } from '@/server/db';
import { requireAdmin } from '@/server/web/current-user';
import { userAction } from '../actions';

export const metadata: Metadata = { title: 'Users' };

export default function AdminUsersPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-bold tracking-wider text-cream">Users</h1>
      <Suspense fallback={<p className="mt-4 text-slate-300">Loading…</p>}>
        <UserTable />
      </Suspense>
    </>
  );
}

async function UserTable() {
  const admin = await requireAdmin();
  const rows = listUsers(getDatabase());

  return (
    <Window className="mt-6 overflow-x-auto p-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs tracking-wider text-slate-300/80 uppercase">
            <th className="py-2 pr-3">Player</th>
            <th className="py-2 pr-3">Role</th>
            <th className="py-2 pr-3">Rank</th>
            <th className="py-2 pr-3 text-right">Games</th>
            <th className="py-2 pr-3">Joined</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((user) => {
            const isSelf = user.id === admin.id;
            return (
              <tr
                key={user.id}
                className="border-t border-frame/20 align-top"
                aria-label={user.username}
              >
                <td className="py-2 pr-3 font-semibold text-slate-100">
                  {user.username}
                  {user.bannedAt && (
                    <span className="ml-2 rounded-sm bg-status-live px-1.5 py-0.5 text-[10px] uppercase">
                      Banned
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 capitalize">{user.role}</td>
                <td className="py-2 pr-3">
                  {tierFor(user.rating).label} · {user.rating}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{user.gamesPlayed}</td>
                <td className="py-2 pr-3">{user.createdAt.toISOString().slice(0, 10)}</td>
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
    </Window>
  );
}
