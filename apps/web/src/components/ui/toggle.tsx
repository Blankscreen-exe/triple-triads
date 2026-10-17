'use client';

interface ToggleProps {
  readonly label: string;
  readonly hint?: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChange: (checked: boolean) => void;
}

/** An on/off switch backed by a real checkbox, so it is keyboard- and screen-reader-friendly. */
export function Toggle({ label, hint, checked, disabled = false, onChange }: ToggleProps) {
  return (
    <label
      className={`flex items-center justify-between gap-3 py-1 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <span>
        <span className="block text-sm text-slate-100">{label}</span>
        {hint && <span className="block text-xs text-slate-300/70">{hint}</span>}
      </span>
      <span className="relative inline-block h-5 w-9 shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
        />
        <span className="absolute inset-0 rounded-full bg-black/40 ring-1 ring-frame/50 transition peer-checked:bg-action peer-focus-visible:ring-2 peer-focus-visible:ring-cream" />
        <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-cream transition peer-checked:translate-x-4" />
      </span>
    </label>
  );
}
