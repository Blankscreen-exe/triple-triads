'use client';

interface PaginationProps {
  readonly page: number;
  readonly pageCount: number;
  readonly onChange: (page: number) => void;
  /** What is being paged, for screen readers, e.g. "Decks". */
  readonly label: string;
  readonly className?: string;
}

const STEP =
  'flex size-9 items-center justify-center rounded-md border border-frame/60 bg-black/25 text-lg text-cream transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cream disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black/25';

/** ‹ Page 2 of 5 › controls. Shows nothing when everything fits on one page. */
export function Pagination({ page, pageCount, onChange, label, className = '' }: PaginationProps) {
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label={`${label} pages`}
      className={`flex items-center justify-center gap-4 ${className}`}
    >
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => {
          onChange(page - 1);
        }}
        className={STEP}
      >
        ‹
      </button>
      <p className="text-sm text-slate-200 tabular-nums" aria-live="polite">
        Page {page} of {pageCount}
      </p>
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => {
          onChange(page + 1);
        }}
        className={STEP}
      >
        ›
      </button>
    </nav>
  );
}
