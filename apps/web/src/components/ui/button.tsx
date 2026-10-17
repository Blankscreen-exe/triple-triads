import type { ComponentPropsWithoutRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border border-gold-light bg-linear-to-b from-gold-light to-gold px-4 py-2 text-ink hover:brightness-110',
  secondary: 'border border-frame/60 bg-black/25 px-4 py-2 text-slate-100 hover:bg-white/10',
  quiet: 'px-2 py-1 text-sm text-slate-200/80 hover:bg-white/10 hover:text-white',
};

/** Button styles, also used for links that look like buttons. */
export function buttonClasses(variant: ButtonVariant = 'primary', className = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${className}`;
}

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  readonly variant?: ButtonVariant;
}

export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}
