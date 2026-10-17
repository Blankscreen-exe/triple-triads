import type { ComponentPropsWithoutRef } from 'react';

/** The FF8-style menu window: blue-grey gradient panel with a light border. */
export function Window({ className = '', ...props }: ComponentPropsWithoutRef<'section'>) {
  return (
    <section
      className={`rounded-lg border-2 border-frame/75 bg-linear-to-b from-window-top/85 to-window-bottom/95 shadow-[0_0_0_3px_var(--color-night),0_10px_30px_rgb(0_0_0/0.55)] ${className}`}
      {...props}
    />
  );
}
