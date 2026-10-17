import { Window } from '@/components/ui/window';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Window className="p-8 text-center">
        <h1 className="font-display text-3xl font-bold tracking-wider text-cream">Triple Triad</h1>
        <p className="mt-3 text-slate-200">
          The server is running. The lobby, card maker and deck editor are on their way.
        </p>
      </Window>
    </main>
  );
}
