/** A white flag on a pole: the sign of surrender. Drawn here because emoji flags render in black
 * in some fonts. */
export function WhiteFlagIcon({ className = 'size-5' }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M5 2.5v19" stroke="#c9b48a" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M6 4c2.5-1.4 5-1.4 7.2 0s4.6 1.4 6.8 0v9c-2.2 1.4-4.6 1.4-6.8 0S8.5 11.6 6 13z"
        fill="#fff"
        stroke="#1b2235"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
