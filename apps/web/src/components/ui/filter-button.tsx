'use client';

interface FilterButtonProps {
  readonly open: boolean;
  readonly onToggle: () => void;
  /** How many filters are on, shown as a badge so hidden filters are never a surprise. */
  readonly activeCount: number;
  /** Id of the element holding the filters it shows and hides. */
  readonly controls: string;
  readonly className?: string;
}

/** A funnel button that shows or hides a list's filters (used on phones). */
export function FilterButton({
  open,
  onToggle,
  activeCount,
  controls,
  className = '',
}: FilterButtonProps) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={activeCount > 0 ? `Filters (${String(activeCount)} on)` : 'Filters'}
      onClick={onToggle}
      className={`relative flex size-10.5 shrink-0 items-center justify-center rounded-md border text-cream transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cream ${open ? 'border-cream bg-white/10' : 'border-frame/60 bg-black/25'} ${className}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
        <path
          d="M3.5 5h17l-6.5 8v5.5l-4 1.5v-7z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      {activeCount > 0 && (
        <span
          aria-hidden
          className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-action text-[11px] font-bold text-white"
        >
          {activeCount}
        </span>
      )}
    </button>
  );
}
