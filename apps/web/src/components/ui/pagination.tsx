import Link from 'next/link';

interface PaginationBase {
  readonly page: number;
  readonly pageCount: number;
  /** What is being paged, for screen readers, e.g. "Decks". */
  readonly label: string;
  readonly className?: string;
}

/**
 * Either `onChange` (lists paged in the browser) or `hrefFor` (lists paged on the server, where
 * each page has its own URL). No `'use client'`: with `hrefFor` it renders on the server.
 */
type PaginationProps = PaginationBase &
  (
    | { readonly onChange: (page: number) => void; readonly hrefFor?: never }
    | { readonly hrefFor: (page: number) => string; readonly onChange?: never }
  );

const STEP =
  'flex size-9 items-center justify-center rounded-md border border-frame/60 bg-black/25 text-lg text-cream transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cream';
const DISABLED_LINK = 'cursor-not-allowed opacity-40 hover:bg-black/25';
const DISABLED_BUTTON =
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black/25';

/** ‹ Page 2 of 5 › controls. Shows nothing when everything fits on one page. */
export function Pagination({
  page,
  pageCount,
  label,
  className = '',
  onChange,
  hrefFor,
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const step = (target: number, stepLabel: string, glyph: string) => {
    const disabled = target < 1 || target > pageCount;
    if (hrefFor) {
      return disabled ? (
        <span
          aria-disabled="true"
          aria-label={stepLabel}
          role="link"
          className={`${STEP} ${DISABLED_LINK}`}
        >
          {glyph}
        </span>
      ) : (
        <Link href={hrefFor(target)} aria-label={stepLabel} className={STEP}>
          {glyph}
        </Link>
      );
    }
    return (
      <button
        type="button"
        aria-label={stepLabel}
        disabled={disabled}
        onClick={() => {
          onChange(target);
        }}
        className={`${STEP} ${DISABLED_BUTTON}`}
      >
        {glyph}
      </button>
    );
  };

  return (
    <nav
      aria-label={`${label} pages`}
      className={`flex items-center justify-center gap-4 ${className}`}
    >
      {step(page - 1, 'Previous page', '‹')}
      <p className="text-sm text-slate-200 tabular-nums" aria-live="polite">
        Page {page} of {pageCount}
      </p>
      {step(page + 1, 'Next page', '›')}
    </nav>
  );
}
