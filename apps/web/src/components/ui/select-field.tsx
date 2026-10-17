'use client';

import { useId, type ReactNode } from 'react';

interface SelectFieldProps {
  readonly label: string;
  readonly value: string;
  readonly disabled?: boolean;
  readonly hint?: string;
  readonly onChange: (value: string) => void;
  readonly children: ReactNode;
}

export function SelectField({
  label,
  value,
  disabled = false,
  hint,
  onChange,
  children,
}: SelectFieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-100">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="mt-1 w-full rounded-md border border-frame/50 bg-black/30 px-3 py-2 text-sm text-slate-100 [color-scheme:dark] focus:ring-2 focus:ring-cream focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        {children}
      </select>
      {hint && <p className="mt-1 text-xs text-slate-300/70">{hint}</p>}
    </div>
  );
}
