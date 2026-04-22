import type { CSSProperties } from "react";

type LoaderColorFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onClear: () => void;
};

export function LoaderColorField({
  label,
  value,
  placeholder,
  onChange,
  onClear,
}: LoaderColorFieldProps) {
  const normalized = value.trim();
  const displayValue = normalized || placeholder;
  const colorValue = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)
    ? normalized
    : placeholder;
  const empty = normalized.length === 0;

  const swatchStyle = {
    backgroundColor: colorValue,
  } as CSSProperties;

  return (
    <label className="block">
      <div className="min-h-[32px] text-[11px] font-semibold uppercase tracking-[0.15em] leading-4 text-[color:var(--bp-muted)]">
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[color:var(--bp-stroke)]">
          <div className="absolute inset-[2px] rounded-full" style={swatchStyle} />
          <input
            type="color"
            value={colorValue}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
        <input
          type="text"
          value={displayValue}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          placeholder={placeholder}
          className="w-full appearance-none rounded-none border-0 bg-transparent px-0 py-1 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 placeholder:text-[color:var(--bp-muted)] focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
        />
        <button
          type="button"
          onClick={onClear}
          className={`ml-1 text-sm leading-none text-[color:var(--bp-muted)] transition hover:text-[color:var(--bp-ink)] ${
            empty ? "opacity-40" : ""
          }`}
          aria-label="Очистить цвет"
        >
          ×
        </button>
      </div>
    </label>
  );
}
