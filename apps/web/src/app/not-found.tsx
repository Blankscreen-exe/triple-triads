import Link from 'next/link';
import { buttonClasses } from '@/components/ui/button';
import { Window } from '@/components/ui/window';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Window className="space-y-4 p-8 text-center">
        <h1 className="font-display text-2xl font-bold tracking-wider text-cream">
          Page not found
        </h1>
        <p className="text-slate-200">There is nothing at this address.</p>
        <Link href="/" className={buttonClasses('primary')}>
          Back to the start
        </Link>
      </Window>
    </main>
  );
}
