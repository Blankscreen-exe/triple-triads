import { useId, type ComponentPropsWithoutRef } from 'react';

interface TextFieldProps extends ComponentPropsWithoutRef<'input'> {
  readonly label: string;
  readonly hint?: string;
}

export function TextField({ label, hint, className = '', ...inputProps }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-100">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hint ? hintId : undefined}
        className="mt-1 w-full rounded-md border border-frame/50 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-cream focus:outline-none"
        {...inputProps}
      />
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-slate-300/70">
          {hint}
        </p>
      )}
    </div>
  );
}
