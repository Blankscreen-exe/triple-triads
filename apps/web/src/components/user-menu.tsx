import Link from 'next/link';
import { logOut } from '@/app/(auth)/actions';
import { tierFor } from '@/lib/rating';
import { getDatabase } from '@/server/db';
import { getPlayerStats } from '@/server/matches/matches';
import { getCurrentUser } from '@/server/web/current-user';
import { Button, buttonClasses } from './ui/button';

export async function UserMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className={buttonClasses('quiet')}>
          Log in
        </Link>
        <Link href="/signup" className={buttonClasses('primary', '!py-1.5 text-sm')}>
          Sign up
        </Link>
      </div>
    );
  }

  const stats = getPlayerStats(getDatabase(), user.id);
  return (
    <div className="flex items-center gap-3">
      {stats && (
        <span
          className="hidden rounded-sm border border-frame/50 bg-black/20 px-2 py-0.5 text-[11px] tracking-wider uppercase sm:inline"
          title="Your rating"
        >
          {tierFor(stats.rating).label} · {stats.rating}
        </span>
      )}
      <span className="text-sm text-slate-100">
        {user.username}
        {user.role === 'admin' && (
          <span className="ml-2 rounded-sm border border-frame/50 px-1.5 py-0.5 text-[10px] tracking-wider uppercase">
            Admin
          </span>
        )}
      </span>
      <form action={logOut}>
        <Button type="submit" variant="quiet">
          Log out
        </Button>
      </form>
    </div>
  );
}
